import { Command } from '@oclif/core';

export default class Link extends Command {
  static description =
    "Associates a PowerSync instance with this directory's config. Use a subcommand for cloud or self-hosted.";
  static summary = 'Link configuration to a PowerSync instance.';
  static enableStrictArgs = true;

  async run(): Promise<void> {
    await this.parse(Link);
    this.log('Use a subcommand: link cloud | link self-hosted');
  }
}
