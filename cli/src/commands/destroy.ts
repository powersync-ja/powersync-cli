import { Flags, ux } from '@oclif/core';
import { CloudInstanceCommand } from '@powersync/cli-core';
import ora from 'ora';

import { waitForOperationStatusChange } from '../api/cloud/wait-for-operation.js';

export default class Destroy extends CloudInstanceCommand {
  static description = 'Permanently delete the linked PowerSync Cloud instance and its data. Requires --confirm=yes.';
  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --confirm=yes'];
  static flags = {
    confirm: Flags.string({
      description: 'Set to "yes" to confirm destruction of the instance.',
      options: ['yes']
    }),
    ...CloudInstanceCommand.flags
  };
  static summary = '[Cloud only] Permanently destroy the linked Cloud instance.';

  async run(): Promise<void> {
    const { flags } = await this.parse(Destroy);

    if (flags.confirm !== 'yes') {
      this.styledError({ message: 'Destruction requires confirmation. Run with --confirm=yes to confirm.' });
    }

    const { linked } = await this.loadProject(flags);
    const { client } = this;

    const spinner = ora({
      discardStdin: false,
      prefixText: `\n${ux.colorize('red', 'Destroying')} instance ${ux.colorize('blue', linked.instance_id)} in project ${ux.colorize('blue', linked.project_id)} in org ${ux.colorize('blue', linked.org_id)}\n`,
      spinner: 'moon',
      suffixText: '\nThis may take a few minutes.\n'
    });

    spinner.start();

    try {
      const deactivateResult = await client.deactivateInstance({
        app_id: linked.project_id,
        id: linked.instance_id,
        org_id: linked.org_id
      });

      const status = await waitForOperationStatusChange({
        client,
        instanceId: linked.instance_id,
        linked,
        operationId: deactivateResult.operation_id!,
        timeoutMs: 10 * 60 * 1000
      });

      spinner.stop();

      if (status === 'completed') {
        this.log(ux.colorize('green', 'Instance destroyed successfully.'));
      } else {
        this.styledError({
          message: `Operation failed. Check instance diagnostics for details, for example: ${ux.colorize('blue', 'powersync fetch status')}`
        });
      }
    } catch (error) {
      spinner.stop();
      this.styledError({
        error,
        message: `Failed to destroy instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`,
        suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
      });
    }
  }
}
