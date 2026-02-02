import {Command} from '@oclif/core'

export default class Fetch extends Command {
  static description = 'Commands to list instances, pull config, or get diagnostics status.'
  static summary = 'Fetch data from PowerSync (instances, config, status).'

  async run(): Promise<void> {
    await this.parse(Fetch)
    this.log('Use a subcommand: fetch instances | fetch config | fetch status')
  }
}
