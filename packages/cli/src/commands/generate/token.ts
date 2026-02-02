import {Command} from '@oclif/core'

export default class GenerateToken extends Command {
  static description =
    'Generates a development token for connecting clients. Cloud and self-hosted (when shared secret is in config).'
  static summary = 'Create a client token for the PowerSync service.'

  async run(): Promise<void> {
    this.log('generate token: not yet implemented')
  }
}
