import { confirm, password, select } from '@inquirer/prompts';
import { ux } from '@oclif/core';
import { createAccountsHubClient, PowerSyncCommand, Services } from '@powersync/cli-core';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import open from 'open';
import ora from 'ora';

export default class Login extends PowerSyncCommand {
  static description =
    'Store a PowerSync auth token (PAT) in secure storage so later Cloud commands run without passing a token. Use TOKEN env var for CI or scripts instead.';
  static summary = 'Store auth token in secure storage for Cloud commands.';

  async run(): Promise<void> {
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

    const tokenMethod = await select({
      message: 'How would you like to provide your token?',
      choices: [
        { value: 'browser', name: 'Open a browser to generate a token' },
        { value: 'existing', name: 'Enter an existing token' }
      ]
    });

    const token = tokenMethod === 'browser'
      ? await new Promise<string>((resolve, reject) => {
          const server = createServer();
          const spinner = ora('Waiting for you to create a token in the dashboard…').start();
          server.once('error', (err) => {
            spinner.fail();
            reject(err);
          });

          // Bind to loopback only so the callback is not reachable from other interfaces
          server.listen(0, '127.0.0.1', () => {
            const addressInfo = server.address();
            if (typeof addressInfo !== 'object' || addressInfo === null || !('port' in addressInfo)) {
              spinner.fail();
              reject(new Error('Failed to get address'));
              return;
            }
            const { port } = addressInfo as AddressInfo;
            // Dashboard will fetch() POST the token to this URL (no redirect; token in body).
            const responseUrl = `http://127.0.0.1:${port}/response`;
            open(
              `https://dashboard.powersync.com/account/access-tokens/create?response_url=${encodeURIComponent(responseUrl)}`
            );
          });

          let settled = false;
          const rejectWith = (err: Error) => {
            if (settled) return;
            settled = true;
            spinner.fail();
            server.close();
            reject(err);
          };

          server.on('request', (req, res) => {
            if (req.method !== 'POST' || !req.url?.startsWith('/response')) {
              res.statusCode = 400;
              res.end();
              rejectWith(new Error('Invalid request: expected POST /response'));
              return;
            }
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
                spinner.succeed();
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
      : await password({
          message: 'Enter your API token (https://docs.powersync.com/usage/tools/cli#personal-access-token):',
          mask: true
        });

    if (!token?.trim()) {
      this.styledError({ message: 'Token is required.' });
    }

    this.log(ux.colorize('blue', 'Testing token...'));
    try {
      await authentication.setToken(token.trim());
      const orgs = await listOrgs();
      this.log(ux.colorize('blue', 'You have access to the following organizations:'));
      this.log(ux.colorize('gray', orgs));
      this.log(ux.colorize('green', 'Token is valid.'));
      this.log(ux.colorize('green', 'Token stored successfully.'));
    } catch (err) {
      await authentication.deleteToken();
      this.styledError({ message: 'Invalid token. Please try again.', error: err });
    }
  }
}
