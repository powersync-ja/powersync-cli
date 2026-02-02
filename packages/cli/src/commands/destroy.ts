import {Command} from '@oclif/core'

export default class Destroy extends Command {
  static description = 'Destroys the linked PowerSync Cloud instance. Cloud only.'
  static summary = 'Destroy a PowerSync instance.'

  async run(): Promise<void> {
    this.log('destroy: not yet implemented')
  }
}
