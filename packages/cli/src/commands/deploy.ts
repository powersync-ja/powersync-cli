import { routes } from '@powersync/management-types';
import { CloudInstanceCommand } from '../command-types/CloudInstanceCommand.js';

/** Pretty-print test connection response for error output. Uses types from @powersync/management-types (BaseTestConnectionResponse). */
function formatTestConnectionFailure(
  response: {
    success?: boolean;
    connection?: { success?: boolean; reachable?: boolean };
    configuration?: { success?: boolean };
    error?: string;
  },
  connectionName: string
): string {
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
          `
Failed to get existing config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}
Ensure the instance has been created before deploying.
          `.trim(),
          { exit: 1 }
        );
      });

    const existingRegion = existingConfig.config?.region;
    if (existingRegion && existingRegion !== config.region) {
      this.error(
        `
The existing config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id} has a different region than the config being deployed.
The region cannot be changed after the initial deployment.
Existing region: ${existingRegion}
New region: ${config.region}
          `.trim(),
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
        .testConnection({
          // The instance ID allows secret_refs to be used
          id: linked.instance_id,
          org_id: linked.org_id,
          app_id: linked.project_id,
          connection
        })
        .catch((error) => {
          this.error(`Failed to test connection for connection ${connection.name}: ${error}`, { exit: 1 });
        });
      if (response.success !== true) {
        this.error(formatTestConnectionFailure(response, connection.name ?? 'unnamed'), { exit: 1 });
      }
    }
    this.log('Connection test successful.');

    this.log(
      `Deploying changes to instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`
    );

    try {
      await client.deployInstance(
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
      this.error(
        `Failed to deploy changes to instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
        { exit: 1 }
      );
    }
  }
}
