import { ux } from '@oclif/core';
import { PowerSyncCommand, Services } from '@powersync/cli-core';

export default class Logout extends PowerSyncCommand {
  static description =
    'Remove the stored PowerSync auth token from secure storage or local fallback config storage. Cloud commands will no longer use stored credentials until you run login again.';
  static summary = 'Remove stored auth token.';

  async run(): Promise<void> {
    const { authentication } = Services;

    const token = await authentication.getToken();
    if (!token) {
      this.log('You were not logged in. Logout is a no-op.');
      return;
    }

    await authentication.deleteToken();
    this.log(ux.colorize('green', 'Logged out successfully.'));
  }
}
