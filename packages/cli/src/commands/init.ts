import {Command} from '@oclif/core'

export default class Init extends Command {
  static description =
    'Creates a PowerSync project (e.g. powersync folder with service.yaml and sync-streams.yaml). Supports --type=cloud or self-hosted.'
  static summary = 'Create a new PowerSync project.'

  async run(): Promise<void> {
    this.log('init: not yet implemented')
  }
}
