import { Command, ux } from '@oclif/core';

export default class Init extends Command {
  static description =
    'Scaffold a PowerSync config directory from a template. Use init cloud or init self-hosted. For Cloud, edit service.yaml then run link cloud and deploy.';
  static summary = 'Scaffold a PowerSync config directory from a template.';
  async run(): Promise<void> {
    await this.parse(Init);
    this.log(ux.colorize('yellow', 'Use a subcommand: ') + ux.colorize('blue', 'init cloud | init self-hosted'));
  }
}
