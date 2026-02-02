import {Command} from '@oclif/core'

export default class Login extends Command {
  static description = 'Authenticate the CLI with PowerSync (e.g. PAT token).'
  static summary = 'Authenticate the CLI with PowerSync (e.g. PAT token).'

  async run(): Promise<void> {
    this.log('login: not yet implemented')
  }
}
