import { Flags, ux } from '@oclif/core';
import { CloudInstanceCommand, SERVICE_FILENAME } from '@powersync/cli-core';
import { routes } from '@powersync/management-types';
import ora from 'ora';

import { formatTestConnectionFailure, testCloudConnections } from '../../api/cloud/test-connection.js';
import { DEFAULT_DEPLOY_TIMEOUT_MS, waitForOperationStatusChange } from '../../api/cloud/wait-for-operation.js';

/**
 * Deploys the sync config and service configuration
 */
export default class DeployAll extends CloudInstanceCommand {
  static description = [
    'Deploy local config (service.yaml, sync config) to the linked PowerSync Cloud instance.',
    'Validates connections and sync config before deploying.',
    `See also ${ux.colorize('blue', 'powersync deploy sync-config')} to deploy only sync config changes.`
  ].join('\n');
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<id>'
  ];
  static flags = {
    'deploy-timeout': Flags.integer({
      default: DEFAULT_DEPLOY_TIMEOUT_MS / 1000,
      description:
        'Seconds to wait after scheduling a deploy before timing out while polling status (default 300 seconds).',
      async parse(input) {
        const value = Number(input);
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error('deploy-timeout must be a positive number of seconds');
        }

        return value;
      }
    }),
    ...CloudInstanceCommand.flags
  };
  static summary = '[Cloud only] Deploy local config to the linked Cloud instance (connections + auth + sync config).';

  protected async deployAll(params: {
    cloudConfigState: routes.InstanceConfigResponse;
    deployTimeoutMs: number;
    updateSyncConfig: boolean;
  }): Promise<void> {
    const { cloudConfigState, deployTimeoutMs, updateSyncConfig } = params;
    const { client, project } = this;
    const { linked, syncRulesContent } = project;
    const config = this.serviceConfig;
    if (!config) {
      this.styledError({
        message: `Service config not loaded. Ensure ${SERVICE_FILENAME} is present and valid.`
      });
    }

    return this.withDeploy(deployTimeoutMs, async () =>
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
          sync_rules: updateSyncConfig ? syncRulesContent : cloudConfigState.sync_rules
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

    const deployTimeoutMs = (flags['deploy-timeout'] ?? DEFAULT_DEPLOY_TIMEOUT_MS / 1000) * 1000;

    // Parse and store for later
    this.parseConfig(project.projectDirectory);

    // The existing config is required to deploy changes. The instance should have been created already.
    const cloudConfigState = await this.loadCloudConfigState();

    // Start of validations
    this.log('Performing validations before deploy...');

    const instanceStatus = await this.client
      .getInstanceStatus({
        app_id: project.linked.project_id,
        id: project.linked.instance_id,
        org_id: project.linked.org_id
      })
      .catch((error) => {
        this.styledError({
          error,
          message: `Failed to get status for instance ${project.linked.instance_id} in project ${project.linked.project_id} in org ${project.linked.org_id}.`,
          suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
        });
      });

    const requiresReprovision = instanceStatus.provisioned === false;
    const syncConfigHasChanges = project.syncRulesContent !== cloudConfigState.sync_rules;

    await this.validateServiceConfig({ cloudConfigState });
    await this.testConnections();

    this.log('\tValidating sync config...');
    /**
     * At this point we know the instances is deprovisioned, and the current config is valid.
     * We can't verify the sync config yet - since that requires a provisioned instance.
     * We will attempt to deploy the config without the sync config first,
     * if that succeeds, then we will validate the sync config and deploy again with the sync config.
     */
    if (requiresReprovision && syncConfigHasChanges) {
      this.log(
        [
          `The instance is ${ux.colorize('yellow', 'not currently provisioned')} and we have detected changes to the sync config.`,
          `To ensure the instance is successfully provisioned with a valid config, we will first deploy without the sync config, then validate and deploy again with the sync config.`
        ].join('\n')
      );

      await this.deployAll({ cloudConfigState, deployTimeoutMs, updateSyncConfig: false });
    }

    await this.validateSyncConfig();

    this.log('Validations completed successfully.\n');

    await this.deployAll({ cloudConfigState, deployTimeoutMs, updateSyncConfig: syncConfigHasChanges });
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

  protected async withDeploy(timeoutMs: number, fn: () => Promise<routes.DeployInstanceResponse>): Promise<void> {
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

      const status = await waitForOperationStatusChange({
        client,
        instanceId: deployResult.id,
        linked: project.linked,
        operationId: deployResult.operation_id,
        timeoutMs
      });
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
