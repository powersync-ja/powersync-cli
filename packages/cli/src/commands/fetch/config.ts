import {Command} from '@oclif/core'

export default class FetchConfig extends Command {
  static description =
    'Pulls the current instance config from PowerSync Cloud and writes to local powersync folder. Cloud only.'
  static summary = 'Update local configuration with cloud state.'

  async run(): Promise<void> {
    this.log('fetch config: not yet implemented')
  }
}
