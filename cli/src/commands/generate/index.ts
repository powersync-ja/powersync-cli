import { Command } from '@oclif/core';

export default class Generate extends Command {
  static description =
    'Generate client artifacts: schema (from instance schema + sync config) or a development token for connecting clients. Cloud and self-hosted where supported.';
  static summary = 'Generate client schema or development token.';

  async run(): Promise<void> {
    await this.parse(Generate);
    this.log('Use a subcommand: generate schema | generate token');
  }
}
