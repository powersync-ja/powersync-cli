import { Command, ux } from '@oclif/core';

export default class Migrate extends Command {
  static description =
    'Migrate PowerSync config to newer formats. Use migrate sync-rules to convert Sync Rules to Sync Streams.';
  static summary = 'Migrate config to newer formats (e.g. Sync Rules → Sync Streams).';
  async run(): Promise<void> {
    await this.parse(Migrate);
    this.log(ux.colorize('yellow', 'Use a subcommand: ') + ux.colorize('blue', 'migrate sync-rules'));
  }
}
