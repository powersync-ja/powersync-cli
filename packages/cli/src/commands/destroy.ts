import { Flags } from '@oclif/core';

import { CloudInstanceCommand } from '../command-types/CloudInstanceCommand.js';

export default class Destroy extends CloudInstanceCommand {
  static description = 'Destroys the linked PowerSync Cloud instance. Cloud only.';
  static summary = 'Destroy a PowerSync instance.';

  static flags = {
    confirm: Flags.string({
      description: 'Set to "yes" to confirm destruction of the instance.',
      options: ['yes']
    }),
    ...CloudInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Destroy);

    if (flags.confirm !== 'yes') {
      this.error('Destruction requires confirmation. Run with --confirm=yes to confirm.', { exit: 1 });
    }

    const { linked } = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });
    const client = await this.getClient();

    this.log(`Destroying instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`);

    try {
      await client.destroyInstance({
        app_id: linked.project_id,
        org_id: linked.org_id,
        id: linked.instance_id
      });
    } catch (error) {
      this.error(
        `Failed to destroy instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
        { exit: 1 }
      );
    }
  }
}
