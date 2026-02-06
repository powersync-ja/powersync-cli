import { Flags } from '@oclif/core';

import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';

export default class Stop extends CloudInstanceCommand {
  static description =
    'Deactivate the linked PowerSync Cloud instance. Requires --confirm=yes. Restart later with powersync deploy. Cloud only.';
  static summary = 'Stop the linked Cloud instance (restart with deploy).';

  static flags = {
    confirm: Flags.string({
      description: 'Set to "yes" to confirm stopping the instance.',
      options: ['yes']
    }),
    ...CloudInstanceCommand.flags
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

    const client = await this.getClient();

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
