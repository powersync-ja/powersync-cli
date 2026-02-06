import { password } from '@inquirer/prompts';
import { Command } from '@oclif/core';

import { getSecureStorage } from '../services/SecureStorage.js';

export default class Login extends Command {
  static description = 'Authenticate the CLI with PowerSync (e.g. PAT token).';
  static summary = 'Authenticate the CLI with PowerSync (e.g. PAT token).';

  async run(): Promise<void> {
    const token = await password({
      message: 'Enter your API token (https://docs.powersync.com/usage/tools/cli#personal-access-token):',
      mask: true
    });
    if (!token?.trim()) {
      this.error('Token is required.', { exit: 1 });
    }
    const storage = getSecureStorage();
    await storage.setToken(token.trim());
    this.log('Token stored successfully.');
  }
}
