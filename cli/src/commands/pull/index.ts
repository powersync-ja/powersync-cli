import { Command } from '@oclif/core';

export default class Pull extends Command {
  static description =
    'Download current config from PowerSync Cloud into local YAML files. Use pull instance; pass --instance-id and --project-id when the directory is not yet linked (--org-id is optional when the token has a single organization).';
  static summary = 'Download Cloud config into local service.yaml and sync.yaml.';

  async run(): Promise<void> {
    await this.parse(Pull);
    this.log('Use a subcommand: pull instance');
  }
}
