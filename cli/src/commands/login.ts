import { password } from '@inquirer/prompts';
import { Command } from '@oclif/core';

import { getSecureStorage } from '../services/SecureStorage.js';

export default class Login extends Command {
  static description =
    'Store a PowerSync auth token (PAT) in secure storage so later Cloud commands run without passing a token. Use PS_TOKEN env var for CI or scripts instead.';
  static summary = 'Store auth token in secure storage for Cloud commands.';

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
