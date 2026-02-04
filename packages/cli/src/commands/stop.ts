import { Flags } from '@oclif/core';

import { CloudInstanceCommand } from '../command-types/CloudInstanceCommand.js';

export default class Stop extends CloudInstanceCommand {
  static description =
    'Stops the linked PowerSync Cloud instance. Cloud only. The instance can be started again by running `powersync deploy`.';
  static summary = 'Stop a PowerSync instance.';

  static flags = {
    ...CloudInstanceCommand.flags,
    confirm: Flags.string({
      description: 'Set to "yes" to confirm stopping the instance.',
      options: ['yes']
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Stop);

    if (flags.confirm !== 'yes') {
      this.error('Stopping requires confirmation. Run with --confirm=yes to confirm.', { exit: 1 });
    }

    const { linked } = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });
    const client = this.getClient();

    this.log(`Stopping instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`);

    try {
      await client.deactivateInstance({
        app_id: linked.project_id,
        org_id: linked.org_id,
        id: linked.instance_id
      });
    } catch (error) {
      this.error(
        `Failed to stop instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
        { exit: 1 }
      );
    }
  }
}
