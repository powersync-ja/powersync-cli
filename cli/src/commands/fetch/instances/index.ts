import { Command, ux } from '@oclif/core';

export default class FetchInstances extends Command {
  static description =
    'List PowerSync Cloud instances in the current org and project. Use with a linked directory or pass --org-id and --project-id. Cloud only.';
  static summary = 'List Cloud instances in the current org/project.';

  async run(): Promise<void> {
    this.log(ux.colorize('dim', 'fetch instances: not yet implemented'));
  }
}
