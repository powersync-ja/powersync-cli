import { ux } from '@oclif/core';

import { SelfHostedInstanceCommand } from '@powersync/cli-core';

export default class Migrate extends SelfHostedInstanceCommand {
  static description =
    'Convert a self-hosted service.yaml to PowerSync Cloud format. Self-hosted only. (Not yet implemented.)';
  static summary = 'Convert self-hosted config to Cloud format (not yet implemented).';

  async run(): Promise<void> {
    this.log(ux.colorize('gray', 'migrate: not yet implemented'));
  }
}
