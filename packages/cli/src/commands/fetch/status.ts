import {Command} from '@oclif/core'

export default class FetchStatus extends Command {
  static description =
    'Fetches diagnostics (connections, sync rules state, etc.). Routes to Management service (Cloud) or linked instance (self-hosted).'
  static summary = 'Fetch diagnostics status for an instance.'

  async run(): Promise<void> {
    this.log('fetch status: not yet implemented')
  }
}
