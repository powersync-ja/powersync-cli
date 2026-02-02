import {Command} from '@oclif/core'

export default class Deploy extends Command {
  static description = 'Deploys changes to the PowerSync management service. Cloud only.'
  static summary = 'Deploy sync rules and configuration changes.'

  async run(): Promise<void> {
    this.log('deploy: not yet implemented')
  }
}
