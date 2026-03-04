import { Command } from '@oclif/core';

export default class Configure extends Command {
  static description = 'Configure your workspace or IDE for PowerSync development.';
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static hidden = true;
  static summary = 'Configure your workspace or IDE for PowerSync development.';

  async run(): Promise<void> {
    await this.parse(Configure);
    this.log('Use a subcommand: configure ide');
  }
}
