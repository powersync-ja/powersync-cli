import { SelfHostedInstanceCommand } from '../command-types/SelfHostedInstanceCommand.js';

export default class Migrate extends SelfHostedInstanceCommand {
  static description = 'Migrates a self-hosted instance configuration to PowerSync Cloud format. Self-hosted only.';
  static summary = 'Migrate a self-hosted config to a cloud config.';

  async run(): Promise<void> {
    this.log('migrate: not yet implemented');
  }
}
