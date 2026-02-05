import type { RequiredCloudLinkConfig } from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { routes } from '@powersync/management-types';
import ora from 'ora';
import { CloudInstanceCommand } from '../command-types/CloudInstanceCommand.js';

const STATUS_POLL_INTERVAL_MS = 5000;
type DeployStatus = 'pending' | 'running' | 'failed' | 'completed';

async function waitForStatusChange(
  client: PowerSyncManagementClient,
  linked: RequiredCloudLinkConfig,
  instanceId: string
): Promise<DeployStatus> {
  for (;;) {
    const result = await client.getInstanceStatus({
      org_id: linked.org_id,
      app_id: linked.project_id,
      id: instanceId
    });
    const operation = result.operations?.[0];
    const status = operation?.status as DeployStatus | undefined;
    if (status === 'failed' || status === 'completed') return status;
    if (status === undefined) {
      // No operation or unknown status; trpeat as failed to avoid infinite loop
      return 'failed';
    }
    await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_INTERVAL_MS));
  }
}

/** Pretty-print test connection response for error output. Uses types from @powersync/management-types (BaseTestConnectionResponse). */
function formatTestConnectionFailure(response: routes.TestConnectionResponse, connectionName: string): string {
  const lines: string[] = [
    `Failed to test connection for connection "${connectionName}":`,
    '',
    '  Overall success: ' + String(response.success),
    '  Error: ' + (response.error ?? '(none)'),
    '',
    '  Checks:',
    '    • connection.success: ' + String(response.connection?.success ?? '—'),
    '    • connection.reachable: ' + String(response.connection?.reachable ?? '—'),
    '    • configuration.success: ' + String(response.configuration?.success ?? '—')
  ];
  return lines.join('\n');
}

export default class Deploy extends CloudInstanceCommand {
  static description = 'Deploys changes to the PowerSync management service. Cloud only.';
  static summary = 'Deploy sync rules and configuration changes.';

  static flags = {
    ...CloudInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Deploy);

    const { projectDirectory, linked, syncRulesContent } = this.loadProject(flags, {
      configFileRequired: true,
      linkingIsRequired: true
    });

    const config = this.parseConfig(projectDirectory);
    const client = await this.getClient();

    // The existing config is required to deploy changes. The isntance should have been created already.
    const existingConfig = await client
      .getInstanceConfig({
        app_id: linked.project_id,
        org_id: linked.org_id,
        id: linked.instance_id
      })
      .catch((error) => {
        this.error(
          [
            `Failed to get existing config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
            'Ensure the instance has been created before deploying.'
          ].join('\n'),
          { exit: 1 }
        );
      });

    const existingRegion = existingConfig.config?.region;
    if (existingRegion && existingRegion !== config.region) {
      this.error(
        [
          `The existing config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id} has a different region than the config being deployed.`,
          'The region cannot be changed after the initial deployment.',
          `Existing region: ${existingRegion}`,
          `New region: ${config.region}`
        ].join('\n'),
        { exit: 1 }
      );
    }

    // Validate region against list of regions obtained from client.listRegions()
    const regions = await client.listRegions({}).catch((error) => {
      this.error(`Could not validate region against list of regions: Failed to list regions: ${error}`, { exit: 1 });
    });

    const foundRegion = regions.regions.find((region) => region.name === config.region);
    if (!foundRegion) {
      this.error(
        `The region ${config.region} is not supported. Please choose a region from the list of supported regions: ${regions.regions.map((region) => region.name).join(', ')}`,
        { exit: 1 }
      );
    }

    this.log('Testing connection before deploy...');
    if ((config.replication?.connections?.length ?? 0) <= 0) {
      this.error(
        'No connection found in config. Please add a connection to the config in replication->connections before deploying.',
        { exit: 1 }
      );
    }
    for (const connection of config.replication?.connections ?? []) {
      const response = await client
        .testConnection(
          routes.TestConnectionRequest.encode({
            // The instance ID allows secret_refs to be used
            id: linked.instance_id,
            org_id: linked.org_id,
            app_id: linked.project_id,
            connection
          })
        )
        .catch((error) => {
          this.error(`Failed to test connection for connection ${connection.name}: ${error}`, { exit: 1 });
        });
      if (response.success !== true) {
        this.error(formatTestConnectionFailure(response, connection.name ?? 'unnamed'), { exit: 1 });
      }
    }
    this.log('Connection test successful.');

    const spinner = ora({
      prefixText: 'Deploying instance.\n',
      spinner: 'moon',
      suffixText: '\nThis may take a few minutes.\n'
    });
    spinner.start();

    let deployResult: { id: string; operation_id?: string };
    try {
      deployResult = await client.deployInstance(
        routes.DeployInstanceRequest.encode({
          // Spread the existing config like name, and program version contraints.
          // Should we allow specifying these in the config file?
          ...existingConfig,
          app_id: linked.project_id,
          config,
          sync_rules: syncRulesContent
        })
      );
    } catch (error) {
      spinner.stop();
      this.error(
        `Failed to deploy changes to instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
        { exit: 1 }
      );
    }

    const status = await waitForStatusChange(client, linked, deployResult.id);
    spinner.stop();

    if (status === 'failed') {
      this.error(
        [
          `Deploy failed for instance ${linked.instance_id}.`,
          'Check instance diagnostics for details, for example:',
          '  powersync fetch status'
        ].join('\n'),
        { exit: 1 }
      );
    }
  }
}
