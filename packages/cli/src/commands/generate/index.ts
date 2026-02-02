import {Command} from '@oclif/core'

export default class Generate extends Command {
  static description = 'Commands to generate client-side schema or development tokens.'
  static summary = 'Generate artifacts (schema, token).'

  async run(): Promise<void> {
    await this.parse(Generate)
    this.log('Use a subcommand: generate schema | generate token')
  }
}
