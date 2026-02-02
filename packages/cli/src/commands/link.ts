import {Command} from '@oclif/core'

export default class Link extends Command {
  static description =
    "Associates a cloud instance (or self-hosted) with this directory's config. Optional instance ID, org_id, app_id."
  static summary = 'Link configuration to a PowerSync instance.'

  async run(): Promise<void> {
    this.log('link: not yet implemented')
  }
}
