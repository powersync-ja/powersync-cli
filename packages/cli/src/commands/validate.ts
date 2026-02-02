import {Command} from '@oclif/core'

export default class Validate extends Command {
  static description = 'Validates configuration. Supported for both Cloud and self-hosted.'
  static summary = 'Validate configuration (sync rules, connection, etc.).'

  async run(): Promise<void> {
    this.log('validate: not yet implemented')
  }
}
