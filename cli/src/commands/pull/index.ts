import { Command } from '@oclif/core';

export default class Pull extends Command {
  static description =
    'Download current config from PowerSync Cloud into local YAML files. Use pull config; pass --instance-id, --org-id, --project-id to link first if not already linked.';
  static summary = 'Download Cloud config into local service.yaml and sync.yaml.';

  async run(): Promise<void> {
    await this.parse(Pull);
    this.log('Use a subcommand: pull config');
  }
}
