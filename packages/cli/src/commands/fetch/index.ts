import { Command } from '@oclif/core';

export default class Fetch extends Command {
  static description =
    'Subcommands: list Cloud instances in org/project (fetch instances), print instance config as YAML/JSON (fetch config), or show instance diagnostics (fetch status).';
  static summary = 'List instances, fetch config, or fetch instance diagnostics.';

  async run(): Promise<void> {
    await this.parse(Fetch);
    this.log('Use a subcommand: fetch instances | fetch config | fetch status');
  }
}
