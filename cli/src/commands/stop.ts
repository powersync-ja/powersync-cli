import { Flags, ux } from '@oclif/core';
import { CloudInstanceCommand } from '@powersync/cli-core';

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
      this.styledError({ message: 'Stopping requires confirmation. Run with --confirm=yes to confirm.' });
    }

    const { linked } = await this.loadProject(flags);

    const client = await this.getClient();

    this.log(
      `Stopping instance ${ux.colorize('blue', linked.instance_id)} in project ${ux.colorize('blue', linked.project_id)} in org ${ux.colorize('blue', linked.org_id)}`
    );

    try {
      await client.deactivateInstance({
        app_id: linked.project_id,
        org_id: linked.org_id,
        id: linked.instance_id
      });

      this.log(ux.colorize('green', 'Instance stopped successfully.'));
    } catch (error) {
      this.styledError({
        message: `Failed to stop instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`,
        error
      });
    }
  }
}
