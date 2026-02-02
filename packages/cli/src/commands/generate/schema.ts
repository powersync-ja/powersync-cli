import {Command} from '@oclif/core'

export default class GenerateSchema extends Command {
  static description =
    'Generates client-side schema from instance schema and sync rules. Supported for Cloud and self-hosted.'
  static summary = 'Create client-side schemas.'

  async run(): Promise<void> {
    this.log('generate schema: not yet implemented')
  }
}
