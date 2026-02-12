import { ux } from '@oclif/core';

import { PowerSyncCommand, Services } from '@powersync/cli-core';

export default class Logout extends PowerSyncCommand {
  static description =
    'Remove the stored PowerSync auth token from secure storage. Cloud commands will no longer use stored credentials until you run login again.';
  static summary = 'Remove stored auth token from secure storage.';

  async run(): Promise<void> {
    const { authentication } = Services;

    const token = await authentication.getToken();
    if (!token) {
      this.log(ux.colorize('yellow', 'You were not logged in.'));
      return;
    }

    await authentication.deleteToken();
    this.log(ux.colorize('green', 'Logged out successfully.'));
  }
}
