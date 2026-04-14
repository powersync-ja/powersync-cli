import { Command } from '@oclif/core';

export default class Pull extends Command {
  static description =
    'Download current config from PowerSync Cloud into local YAML files. Use pull instance; pass --instance-id when the directory is not yet linked.';
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static hidden = true;
  static summary = '[Cloud only] Download Cloud config into local service.yaml and sync-config.yaml.';

  async run(): Promise<void> {
    await this.parse(Pull);
    this.log('Use a subcommand: pull instance');
  }
}
