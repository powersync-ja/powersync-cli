import {Command} from '@oclif/core'

export default class FetchInstances extends Command {
  static description = 'Lists instances in the current org/project. Cloud only.'
  static summary = 'List PowerSync Cloud instances.'

  async run(): Promise<void> {
    this.log('fetch instances: not yet implemented')
  }
}
