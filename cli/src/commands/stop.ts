import { Flags, ux } from '@oclif/core';
import { CloudInstanceCommand } from '@powersync/cli-core';

export default class Stop extends CloudInstanceCommand {
  static description =
    'Deactivate the linked PowerSync Cloud instance. Requires --confirm=yes. Restart later with powersync deploy.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --confirm=yes'
  ];
  static flags = {
    confirm: Flags.string({
      description: 'Set to "yes" to confirm stopping the instance.',
      options: ['yes']
    }),
    ...CloudInstanceCommand.flags
  };
  static summary = '[Cloud only] Stop the linked Cloud instance (restart with deploy).';

  async run(): Promise<void> {
    const { flags } = await this.parse(Stop);

    if (flags.confirm !== 'yes') {
      this.styledError({ message: 'Stopping requires confirmation. Run with --confirm=yes to confirm.' });
    }

    const { linked } = await this.loadProject(flags);

    const { client } = this;

    this.log(
      `Stopping instance ${ux.colorize('blue', linked.instance_id)} in project ${ux.colorize('blue', linked.project_id)} in org ${ux.colorize('blue', linked.org_id)}`
    );

    try {
      await client.deactivateInstance({
        app_id: linked.project_id,
        id: linked.instance_id,
        org_id: linked.org_id
      });

      this.log(ux.colorize('green', 'Instance stopped successfully.'));
    } catch (error) {
      this.styledError({
        error,
        message: `Failed to stop instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`
      });
    }
  }
}
