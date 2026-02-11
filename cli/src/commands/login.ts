import { password } from '@inquirer/prompts';
import { ux } from '@oclif/core';

import { PowerSyncCommand } from '../command-types/PowerSyncCommand.js';
import { getSecureStorage } from '../services/SecureStorage.js';

export default class Login extends PowerSyncCommand {
  static description =
    'Store a PowerSync auth token (PAT) in secure storage so later Cloud commands run without passing a token. Use PS_TOKEN env var for CI or scripts instead.';
  static summary = 'Store auth token in secure storage for Cloud commands.';

  async run(): Promise<void> {
    const token = await password({
      message: 'Enter your API token (https://docs.powersync.com/usage/tools/cli#personal-access-token):',
      mask: true
    });
    if (!token?.trim()) {
      this.styledError({ message: 'Token is required.' });
    }
    const storage = getSecureStorage();
    await storage.setToken(token.trim());
    this.log(ux.colorize('green', 'Token stored successfully.'));
  }
}
