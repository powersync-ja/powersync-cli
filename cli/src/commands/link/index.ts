import { Command } from '@oclif/core';

export default class Link extends Command {
  static description =
    "Write cli.yaml so this directory's config is bound to a PowerSync instance. Once linked, commands use that instance without passing IDs. Use link cloud or link self-hosted.";
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static summary = 'Bind this directory to a Cloud or self-hosted instance (writes cli.yaml).';

  async run(): Promise<void> {
    await this.parse(Link);
    this.log('Use a subcommand: link cloud | link self-hosted');
  }
}
