import { confirm, password } from '@inquirer/prompts';
import { ux } from '@oclif/core';
import { createAccountsHubClient, PowerSyncCommand, Services } from '@powersync/cli-core';

import { startPATLoginServer } from '../api/login-server.js';

export default class Login extends PowerSyncCommand {
  static description =
    'Store a PowerSync auth token (PAT) in secure storage so later Cloud commands run without passing a token. If secure storage is unavailable, login can optionally store it in a local config file. Use TOKEN env var for CI or scripts instead.';
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static summary = 'Store auth token for Cloud commands.';

  async run(): Promise<void> {
    this.parse(Login);

    const { authentication, storage } = Services;
    const shouldUseInsecureStorage =
      !storage.capabilities.supportsSecureStorage &&
      (await confirm({
        default: false,
        message: `Keychain storage is unavailable on this platform. Store token in plaintext at ${storage.insecureStoragePath}? Set the ${ux.colorize('blue', 'TOKEN')} environment variable instead to avoid this.`
      }));

    if (!storage.capabilities.supportsSecureStorage && !shouldUseInsecureStorage) {
      this.log(
        `Login cancelled. Use ${ux.colorize('blue', 'TOKEN')} environment variable for commands, or rerun login and allow local fallback storage.`
      );
      this.exit(0);
    }

    const listOrgs = async (): Promise<string> => {
      const accountsHubClient = await createAccountsHubClient();
      const orgs = await accountsHubClient.listOrganizations({});
      const objects = orgs?.objects ?? [];
      return objects.map((org) => `\t - ${org.label} - ${org.id}`).join('\n');
    };

    const existingToken = await authentication.getToken();
    if (existingToken) {
      this.log('An existing token was found. This existing token has access to the following organizations:');
      try {
        this.log(await listOrgs());
      } catch (error) {
        this.log(
          `\tFailed to list organizations. This is normal if the token is not valid. ${ux.colorize('blue', JSON.stringify(error))}`
        );
      }

      const overwrite = await confirm({
        default: false,
        message: 'Do you want to overwrite the existing token?'
      });
      if (overwrite) {
        await authentication.deleteToken();
        this.log('Existing token deleted.');
      } else {
        this.exit(0);
      }
    }

    const openBrowser = await confirm({
      default: true,
      message: 'Would you like to open a browser to generate a token?'
    });

    // Allows aborting the prompt if the server returns the token
    const abortController = new AbortController();
    const serverResponse = openBrowser ? await startPATLoginServer(abortController.signal) : null;
    if (serverResponse) {
      this.log(
        `Waiting on ${ux.colorize('blue', serverResponse.address)} for you to create a token in the dashboard...`
      );
    }

    const serverTokenPromise = serverResponse
      ? serverResponse.tokenPromise.then((token) => {
          // Abort the prompt if the server returns the token
          abortController.abort();
          return token.trim();
        })
      : null;

    const promptTokenPromise = password(
      {
        mask: true,
        message: openBrowser
          ? 'Enter the token if the browser failed to send it to the CLI'
          : 'Enter your API token (https://docs.powersync.com/usage/tools/cli#personal-access-token):'
      },
      { signal: abortController.signal }
    ).then((token) => {
      abortController.abort();
      return token.trim();
    });

    const token = await Promise.race([serverTokenPromise, promptTokenPromise]);

    if (!token?.trim()) {
      this.styledError({ message: 'Token is required.' });
    }

    this.log('Testing token...');
    try {
      await authentication.setToken(token.trim());
      const orgs = await listOrgs();
      this.log('You have access to the following organizations:');
      this.log(orgs);
      this.log('Token is valid.');
      this.log(ux.colorize('green', 'Token stored successfully.'));
    } catch (error) {
      await authentication.deleteToken();
      this.styledError({ error, message: 'Invalid token. Please try again.' });
    }
  }
}
