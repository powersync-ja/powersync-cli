import { Command, ux } from '@oclif/core';

export default class Link extends Command {
  static description =
    "Write link.yaml so this directory's config is bound to a PowerSync instance. Once linked, commands use that instance without passing IDs. Use link cloud or link self-hosted.";
  static summary = 'Bind this directory to a Cloud or self-hosted instance (writes link.yaml).';
  async run(): Promise<void> {
    await this.parse(Link);
    this.log(ux.colorize('yellow', 'Use a subcommand: ') + ux.colorize('blue', 'link cloud | link self-hosted'));
  }
}
