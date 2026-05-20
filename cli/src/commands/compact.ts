import { ux } from '@oclif/core';
import { CloudInstanceCommand } from '@powersync/cli-core';
import ora from 'ora';

import { waitForOperationStatusChange } from '../api/cloud/wait-for-operation.js';

export default class Compact extends CloudInstanceCommand {
  static description = 'Trigger compaction on the linked PowerSync Cloud instance to reclaim sync bucket storage.';
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static summary = '[Cloud only] Compact the linked Cloud instance.';

  async run(): Promise<void> {
    const { flags } = await this.parse(Compact);
    const { linked } = await this.loadProject(flags);
    const { client } = this;

    const spinner = ora({
      discardStdin: false,
      prefixText: `\n${ux.colorize('yellow', 'Compacting')} instance ${ux.colorize('blue', linked.instance_id)} in project ${ux.colorize('blue', linked.project_id)} in org ${ux.colorize('blue', linked.org_id)}\n`,
      spinner: 'moon',
      suffixText: '\nThis may take a few minutes.\n'
    });

    spinner.start();

    try {
      const compactResult = await client.compact({
        app_id: linked.project_id,
        id: linked.instance_id,
        org_id: linked.org_id
      });

      if (compactResult.operation_id) {
        const status = await waitForOperationStatusChange({
          client,
          instanceId: linked.instance_id,
          linked,
          operationId: compactResult.operation_id,
          timeoutMs: 30 * 60 * 1000
        });

        spinner.stop();

        if (status === 'completed') {
          this.log(ux.colorize('green', 'Instance compacted successfully.'));
        } else {
          this.styledError({
            message: `Operation failed. Check instance diagnostics for details, for example: ${ux.colorize('blue', 'powersync status')}`
          });
        }
      } else {
        spinner.stop();
        this.log(ux.colorize('green', 'Instance compacted successfully.'));
      }
    } catch (error) {
      spinner.stop();
      this.styledError({
        error,
        message: `Failed to compact instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`,
        suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
      });
    }
  }
}
