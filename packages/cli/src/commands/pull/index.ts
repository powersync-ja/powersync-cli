import { Command } from '@oclif/core';

export default class Pull extends Command {
  static description = 'Pull config from PowerSync Cloud (optionally link first if not already linked).';
  static summary = 'Pull config; link if needed.';

  async run(): Promise<void> {
    await this.parse(Pull);
    this.log('Use a subcommand: pull config');
  }
}
