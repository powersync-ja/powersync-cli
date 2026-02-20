import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';

import { ux } from '@oclif/core';
import { CloudInstanceCommand, SERVICE_FILENAME } from '@powersync/cli-core';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { routes } from '@powersync/management-types';
import ora from 'ora';

import { formatTestConnectionFailure, testCloudConnections } from '../../api/cloud/test-connection.js';

const STATUS_POLL_INTERVAL_MS = 5000;
type DeployStatus = 'completed' | 'failed' | 'pending' | 'running';

async function waitForStatusChange(
  client: PowerSyncManagementClient,
  linked: ResolvedCloudCLIConfig,
  instanceId: string
): Promise<DeployStatus> {
  for (;;) {
    const result = await client.getInstanceStatus({
      app_id: linked.project_id,
      id: instanceId,
      org_id: linked.org_id
    });
    const operation = result.operations?.[0];
    const status = operation?.status as DeployStatus | undefined;
    if (status === 'failed' || status === 'completed') return status;
    if (status === undefined) {
      // No operation or unknown status; trpeat as failed to avoid infinite loop
      return 'failed';
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, STATUS_POLL_INTERVAL_MS);
    });
  }
}

/**
 * Deploys the sync config and service configuration
 */
export default class DeployAll extends CloudInstanceCommand {
  static description = [
    'Deploy local config (service.yaml, sync config) to the linked PowerSync Cloud instance.',
    'Validates connections and sync config before deploying.',
    `See also ${ux.colorize('blue', 'powersync deploy sync-config')} to deploy only sync config changes.`
  ].join('\n');
  static flags = {
    ...CloudInstanceCommand.flags
  };
  static summary = '[Cloud only] Deploy local config to the linked Cloud instance (connections + auth + sync config).';

  protected async deployAll(params: { cloudConfigState: routes.InstanceConfigResponse }): Promise<void> {
    const { cloudConfigState } = params;
    const { client, project } = this;
    const { linked, syncRulesContent } = project;
    const config = this.serviceConfig;
    if (!config) {
      this.styledError({
        message: `Service config not loaded. Ensure ${SERVICE_FILENAME} is present and valid.`
      });
    }

    return this.withDeploy(async () =>
      client.deployInstance(
        routes.DeployInstanceRequest.encode({
          // Spread the existing config like name, and program version contraints.
          // Should we allow specifying these in the config file?
          ...cloudConfigState,
          app_id: linked.project_id,
          // The encoding will ensure the correct typing
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config: config as any,
          // Allow updating the instance name
          name: config.name,
          sync_rules: syncRulesContent
        })
      )
    );
  }

  protected async loadCloudConfigState(): Promise<routes.InstanceConfigResponse> {
    const { client, project } = this;
    const { linked } = project;
    return client
      .getInstanceConfig({
        app_id: linked.project_id,
        id: linked.instance_id,
        org_id: linked.org_id
      })
      .catch((error) => {
        this.styledError({
          error,
          message: `Failed to get existing config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}. Ensure the instance has been created before deploying.`
        });
      });
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployAll);

    const project = await this.loadProject(flags, {
      // local config state is required when deploying all
      configFileRequired: true
    });

    // Parse and store for later
    this.parseConfig(project.projectDirectory);

    // The existing config is required to deploy changes. The instance should have been created already.
    const cloudConfigState = await this.loadCloudConfigState();

    // Start of validations
    this.log('Performing validations before deploy...');

    await this.validateServiceConfig({ cloudConfigState });
    await this.testConnections();
    await this.validateSyncConfig();

    this.log('Validations completed successfully.\n');

    await this.deployAll({ cloudConfigState });
  }

  protected async testConnections(): Promise<void> {
    const { client, project } = this;
    const { linked } = project;
    const { serviceConfig } = this;
    if (!serviceConfig) {
      this.styledError({
        message: `Service config not loaded. Ensure ${SERVICE_FILENAME} is present and valid.`
      });
    }

    this.log('\tTesting connections...');
    if ((serviceConfig.replication?.connections?.length ?? 0) <= 0) {
      this.styledError({
        message: 'No connection found in config.',
        suggestions: ['Add a connection to the config in replication->connections before deploying.']
      });
    }

    const connectionResults = await testCloudConnections(
      client,
      linked,
      serviceConfig.replication?.connections ?? []
    ).catch((error) => {
      this.styledError({
        error,
        message: 'Failed to test connections',
        suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
      });
    });
    for (const { connectionName, response } of connectionResults) {
      if (response.success !== true) {
        this.styledError({ message: formatTestConnectionFailure(response, connectionName) });
      }
    }
  }

  protected async validateServiceConfig(params: { cloudConfigState: routes.InstanceConfigResponse }): Promise<void> {
    const { cloudConfigState } = params;
    const { linked } = this.project;

    const { serviceConfig } = this;

    if (!serviceConfig) {
      this.styledError({
        message: `Service config not loaded. Ensure ${SERVICE_FILENAME} is present and valid.`
      });
    }

    this.log('\tValidating configuration...');

    const existingRegion = cloudConfigState.config?.region;
    if (existingRegion && existingRegion !== serviceConfig.region) {
      this.styledError({
        message: `The existing config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id} has a different region than the config being deployed. Existing region: ${existingRegion}. New region: ${serviceConfig.region}. The region cannot be changed after the initial deployment.`,
        suggestions: ['Check your config and try again.']
      });
    }

    // Validate region against list of regions obtained from client.listRegions()
    const regions = await this.client.listRegions().catch((error) => {
      this.styledError({
        error,
        message: 'Could not validate region against list of regions: Failed to list regions',
        suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
      });
    });

    const foundRegion = regions.regions.find((region) => region.name === serviceConfig.region);
    if (!foundRegion) {
      this.styledError({
        message: `The region ${serviceConfig.region} is not supported. Please choose a region from the list of supported regions: ${regions.regions.map((region) => region.name).join(', ')}.`
      });
    }
  }

  protected async validateSyncConfig() {
    const { client, project } = this;
    this.log('\tValidating sync config...');
    const validation = await client
      .validateSyncRules({
        app_id: project.linked.project_id,
        id: project.linked.instance_id,
        org_id: project.linked.org_id,
        sync_rules: project.syncRulesContent ?? ''
      })
      .catch((error) => {
        this.styledError({
          error,
          message: `Failed to validate sync config for instance ${project.linked.instance_id} in project ${project.linked.project_id} in org ${project.linked.org_id}. Ensure the sync config is valid before deploying.`,
          suggestions: ['Check your sync config and try again.']
        });
      });

    if (validation.errors.length > 0) {
      this.styledError({
        message: `Sync config validation failed for instance. Validation errors:\n${validation.errors.map((error) => error.message).join('\n')}`,
        suggestions: ['Check your sync config and try again.']
      });
    }
  }

  protected async withDeploy(fn: () => Promise<routes.DeployInstanceResponse>): Promise<void> {
    const { client, project } = this;
    const spinner = ora({
      prefixText: '\nDeploying instance.\n',
      spinner: 'moon',
      suffixText: '\nThis may take a few minutes.\n'
    });
    spinner.start();

    try {
      const deployResult = await fn();
      this.log(`Deploy operation has been scheduled. Waiting for completion...`);

      const status = await waitForStatusChange(client, project.linked, deployResult.id);
      spinner.stop();

      if (status === 'completed') {
        this.log(ux.colorize('green', 'Deployment operation completed successfully!'));
      } else {
        this.styledError({
          message: `Deploy failed. Check instance diagnostics for details, for example: ${ux.colorize('blue', 'powersync fetch status')}`
        });
      }
    } catch (error) {
      spinner.stop();
      this.styledError({
        error,
        message: `Failed to deploy changes to instance ${project.linked.instance_id} in project ${project.linked.project_id} in org ${project.linked.org_id}`,
        suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
      });
    }
  }
}
