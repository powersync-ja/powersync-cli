import { Command } from '@oclif/core';

/**
 * This cloud only implementation is exported as index.ts
 * in order to allow plugin commands to extend the command name.
 * For example a plugin could add a `fetch instances self-hosted` command.
 */

export default class Fetch extends Command {
  static description =
    'Subcommands: list Cloud instances in org/project (fetch instances), print instance config as YAML/JSON (fetch config), or show instance diagnostics (fetch status).';
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static hidden = true;
  static summary = 'List instances, fetch config, or fetch instance diagnostics.';

  async run(): Promise<void> {
    await this.parse(Fetch);
    this.log('Use a subcommand: fetch instances | fetch config | fetch status');
  }
}
