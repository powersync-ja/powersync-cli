import { confirm, password } from '@inquirer/prompts';
import { ux } from '@oclif/core';

import { createAccountsHubClient, PowerSyncCommand, Services } from '@powersync/cli-core';

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

    const token = await password({
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
