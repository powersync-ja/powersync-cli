import { Command, Flags } from '@oclif/core';

import { getSecureStorage } from '../services/SecureStorage.js';

export default class Login extends Command {
  static description = 'Authenticate the CLI with PowerSync (e.g. PAT token).';
  static summary = 'Authenticate the CLI with PowerSync (e.g. PAT token).';

  static flags = {
    token: Flags.string({
      description: 'PowerSync auth token (e.g. PAT). Stored securely in the system keychain on macOS.',
      required: true
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Login);
    const storage = getSecureStorage();
    await storage.setToken(flags.token);
    this.log('Token stored successfully.');
  }
}
