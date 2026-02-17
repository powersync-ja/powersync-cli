import { confirm, password } from '@inquirer/prompts';
import { ux } from '@oclif/core';
import { createAccountsHubClient, env, PowerSyncCommand, Services } from '@powersync/cli-core';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import open from 'open';

async function startServer(): Promise<{
  address: string;
  tokenPromise: Promise<string>;
}> {
  const server = createServer();

  const address = await new Promise<string>((resolve, reject) => {
    server.once('error', (err) => {
      reject(err);
    });

    server.listen(0, '127.0.0.1', () => {
      const addressInfo = server.address();
      if (typeof addressInfo !== 'object' || addressInfo === null || !('port' in addressInfo)) {
        reject(new Error('Failed to get address'));
        return;
      }
      const { port } = addressInfo as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
      // Dashboard will fetch() POST the token to this URL (no redirect; token in body).
      const baseResponseUrl = `http://127.0.0.1:${port}`;
      resolve(baseResponseUrl);
    });
  });

  return {
    address,
    tokenPromise: new Promise<string>((resolve, reject) => {
      const responseUrl = `${address}/response`;
      open(`${env._PS_DASHBOARD_URL}/account/access-tokens/create?response_url=${encodeURIComponent(responseUrl)}`);

      server.once('error', (err) => {
        reject(err);
      });

      let settled = false;
      const rejectWith = (err: Error) => {
        if (settled) return;
        settled = true;
        server.close();
        reject(err);
      };

      // Allow dashboard origin for CORS (fetch from dashboard to this callback)
      const allowOrigin = env._PS_DASHBOARD_URL.replace(/\/$/, '');
      const corsHeaders = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      };
      const setCors = (res: import('node:http').ServerResponse) => {
        for (const [k, v] of Object.entries(corsHeaders)) res.setHeader(k, v);
      };

      server.on('request', (req, res) => {
        const path = req.url?.split('?')[0] ?? '';
        if (req.method === 'OPTIONS' && path === '/response') {
          setCors(res);
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST' || path !== '/response') {
          setCors(res);
          res.statusCode = 400;
          res.end();
          rejectWith(new Error('Invalid request: expected POST /response'));
          return;
        }
        setCors(res);
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          const contentType = req.headers['content-type'] ?? '';
          if (!contentType.includes('application/json')) {
            res.statusCode = 400;
            res.end();
            rejectWith(new Error('Invalid request: Content-Type must be application/json'));
            return;
          }
          let tokenValue: string | null = null;
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as { token?: string };
            tokenValue = typeof parsed?.token === 'string' ? parsed.token.trim() : null;
          } catch {
            tokenValue = null;
          }
          if (tokenValue) {
            if (settled) return;
            settled = true;
            res.statusCode = 200;
            res.end();
            resolve(tokenValue);
            server.close();
          } else {
            res.statusCode = 400;
            res.end();
            rejectWith(new Error('Invalid request: JSON body must include a non-empty "token" string'));
          }
        });
      });
    })
  };
}

export default class Login extends PowerSyncCommand {
  static description =
    'Store a PowerSync auth token (PAT) in secure storage so later Cloud commands run without passing a token. Use TOKEN env var for CI or scripts instead.';
  static summary = 'Store auth token in secure storage for Cloud commands.';

  async run(): Promise<void> {
    this.parse(Login);

    const { authentication, storage } = Services;

    if (!storage.capabilities.supportsSecureStorage) {
      this.styledError({
        message: 'Secure storage is not yet supported on this platform.',
        suggestions: [`Export and use the ${ux.colorize('blue', 'TOKEN')} environment variable for commands.`]
      });
    }

    const listOrgs = async (): Promise<string> => {
      const accountsHubClient = await createAccountsHubClient();
      const orgs = await accountsHubClient.listOrganizations({});
      const objects = orgs?.objects ?? [];
      return objects.map((org) => `\t - ${org.label} - ${org.id}`).join('\n');
    };

    const existingToken = await authentication.getToken();
    if (existingToken) {
      this.log(
        ux.colorize(
          'blue',
          'An existing token was found. This existing token has access to the following organizations:'
        )
      );
      try {
        this.log(ux.colorize('gray', await listOrgs()));
      } catch (err) {
        this.log(
          ux.colorize(
            'yellow',
            `\tFailed to list organizations. This is normal if the token is not valid. ${JSON.stringify(err)}`
          )
        );
      }
      const overwrite = await confirm({
        message: 'Do you want to overwrite the existing token?',
        default: false
      });
      if (overwrite) {
        await authentication.deleteToken();
        this.log(ux.colorize('green', 'Existing token deleted.'));
      } else {
        this.exit(0);
      }
    }

    const openBrowser = await confirm({
      message: 'Would you like to open a browser to generate a token?',
      default: true
    });

    // Allows aborting the prompt if the server returns the token
    const abortPromptController = new AbortController();
    const serverResponse = openBrowser ? await startServer() : null;
    if (serverResponse) {
      this.log(
        `Waiting on ${ux.colorize('blue', serverResponse.address)} for you to create a token in the dashboard...`
      );
    }
    const serverTokenPromise = serverResponse
      ? serverResponse.tokenPromise.then((token) => {
          // Abort the prompt if the server returns the token
          abortPromptController.abort();
          return token.trim();
        })
      : null;

    const promptTokenPromise = password(
      {
        message: openBrowser
          ? 'Enter the token if the browser failed to send it to the CLI'
          : 'Enter your API token (https://docs.powersync.com/usage/tools/cli#personal-access-token):',
        mask: true
      },
      { signal: abortPromptController.signal }
    );

    const token = await Promise.race([serverTokenPromise, promptTokenPromise]);

    if (!token?.trim()) {
      this.styledError({ message: 'Token is required.' });
    }

    this.log('Testing token...');
    try {
      await authentication.setToken(token.trim());
      const orgs = await listOrgs();
      this.log('You have access to the following organizations:');
      this.log(ux.colorize('gray', orgs));
      this.log(ux.colorize('green', 'Token is valid.'));
      this.log(ux.colorize('green', 'Token stored successfully.'));
    } catch (err) {
      await authentication.deleteToken();
      this.styledError({ message: 'Invalid token. Please try again.', error: err });
    }
  }
}
