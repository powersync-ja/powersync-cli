import { Command } from '@oclif/core';

export default class Stop extends Command {
  static description = 'Stops the linked PowerSync Cloud instance. Cloud only.';
  static summary = 'Stop a PowerSync instance.';

  async run(): Promise<void> {
    this.log('stop: not yet implemented');
  }
}
