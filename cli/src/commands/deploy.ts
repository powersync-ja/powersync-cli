import { ux } from '@oclif/core';
import { CloudInstanceCommand } from '@powersync/cli-core';
import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { routes } from '@powersync/management-types';
import ora from 'ora';
import { formatTestConnectionFailure, testCloudConnections } from '../api/cloud/test-connection.js';

const STATUS_POLL_INTERVAL_MS = 5000;
type DeployStatus = 'pending' | 'running' | 'failed' | 'completed';

async function waitForStatusChange(
  client: PowerSyncManagementClient,
  linked: ResolvedCloudCLIConfig,
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

export default class Deploy extends CloudInstanceCommand {
  static description =
    'Push local config (service.yaml, sync rules) to the linked PowerSync Cloud instance. Tests connections and sync rules first; requires a linked project. Cloud only.';
  static summary = 'Push local config to the linked Cloud instance (connections + sync rules).';

  static flags = {
    ...CloudInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Deploy);

    const { projectDirectory, linked, syncRulesContent } = this.loadProject(flags, {
      configFileRequired: true
    });

    this.log(ux.colorize('cyan', 'Performing validations before deploy...'));
    this.log(ux.colorize('gray', '\tValidating configuration...'));
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
        this.styledError({
          message: `Failed to get existing config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}. Ensure the instance has been created before deploying.`,
          error
        });
      });

    const existingRegion = existingConfig.config?.region;
    if (existingRegion && existingRegion !== config.region) {
      this.styledError({
        message: `The existing config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id} has a different region than the config being deployed. Existing region: ${existingRegion}. New region: ${config.region}. The region cannot be changed after the initial deployment.`,
        suggestions: ['Check your config and try again.']
      });
    }

    // Validate region against list of regions obtained from client.listRegions()
    const regions = await client.listRegions().catch((error) => {
      this.styledError({
        message: 'Could not validate region against list of regions: Failed to list regions',
        error,
        suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
      });
    });

    const foundRegion = regions.regions.find((region) => region.name === config.region);
    if (!foundRegion) {
      this.styledError({
        message: `The region ${config.region} is not supported. Please choose a region from the list of supported regions: ${regions.regions.map((region) => region.name).join(', ')}.`
      });
    }

    this.log(ux.colorize('gray', '\tTesting connections...'));
    if ((config.replication?.connections?.length ?? 0) <= 0) {
      this.styledError({
        message: 'No connection found in config.',
        suggestions: ['Add a connection to the config in replication->connections before deploying.']
      });
    }
    const connectionResults = await testCloudConnections(client, linked, config.replication?.connections ?? []).catch(
      (error) => {
        this.styledError({
          message: 'Failed to test connections',
          error,
          suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
        });
      }
    );
    for (const { connectionName, response } of connectionResults) {
      if (response.success !== true) {
        this.styledError({ message: formatTestConnectionFailure(response, connectionName) });
      }
    }

    this.log(ux.colorize('green', 'Validations completed successfully.\n'));

    const spinner = ora({
      prefixText: '\nDeploying instance.\n',
      spinner: 'moon',
      suffixText: '\nThis may take a few minutes.\n'
    });
    spinner.start();

    const deployResult = await client
      .deployInstance(
        routes.DeployInstanceRequest.encode({
          // Spread the existing config like name, and program version contraints.
          // Should we allow specifying these in the config file?
          ...existingConfig,
          // Allow updating the instance name
          name: config.name,
          app_id: linked.project_id,
          // The encoding will ensure the correct typing
          config: config as any,
          sync_rules: syncRulesContent
        })
      )
      .catch((error) => {
        spinner.stop();
        this.styledError({
          message: `Failed to deploy changes to instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`,
          error
        });
      });

    this.log(ux.colorize('cyan', `Deploy operation has been scheduled. Waiting for completion...`));

    const status = await waitForStatusChange(client, linked, deployResult.id);
    spinner.stop();

    this.log(ux.colorize('green', 'Deployment operation completed successfully!'));

    if (status === 'failed') {
      this.styledError({
        message: `Deploy failed for instance ${linked.instance_id}. Check instance diagnostics for details, for example: ${ux.colorize('blue', 'powersync fetch status')}`
      });
    }
  }
}
