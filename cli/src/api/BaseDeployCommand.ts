import { Flags, ux } from '@oclif/core';
import { CloudInstanceCommand, SERVICE_FILENAME } from '@powersync/cli-core';
import { ServiceCloudConfigDecoded } from '@powersync/cli-schemas';
import { routes } from '@powersync/management-types';
import { ObjectId } from 'bson';
import ora from 'ora';

import { DEFAULT_DEPLOY_TIMEOUT_MS, waitForOperationStatusChange } from './cloud/wait-for-operation.js';

export default abstract class BaseDeployCommand extends CloudInstanceCommand {
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

  protected async deployAll(params: {
    cloudConfigState: routes.InstanceConfigResponse;
    deployTimeoutMs: number;
    updateSyncConfig: boolean;
  }): Promise<void> {
    const { cloudConfigState, deployTimeoutMs, updateSyncConfig } = params;

    return this.withDeploy(deployTimeoutMs, async () =>
      this.deployInstanceConfig({
        cloudConfigState,
        updateSyncConfig
      })
    );
  }

  protected async deployInstanceConfig(params: {
    cloudConfigState: routes.InstanceConfigResponse;
    updateSyncConfig: boolean;
  }): Promise<routes.DeployInstanceResponse> {
    const { cloudConfigState, updateSyncConfig } = params;
    const { client, project } = this;
    const { linked, syncRulesContent } = project;
    const config = this.serviceConfig;
    if (!config) {
      this.styledError({
        message: `Service config not loaded. Ensure ${SERVICE_FILENAME} is present and valid.`
      });
    }

    return client.deployInstance(
      routes.DeployInstanceRequest.encode({
        // Spread the existing config like name, and program version contraints.
        // Should we allow specifying these in the config file?
        ...cloudConfigState,
        app_id: new ObjectId(linked.project_id),
        // The encoding will ensure the correct typing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: config as any,
        // Allow updating the instance name
        name: config.name,
        org_id: new ObjectId(linked.org_id),
        sync_rules: updateSyncConfig ? syncRulesContent : cloudConfigState.sync_rules
      })
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

  override parseLocalConfig(projectDirectory: string): ServiceCloudConfigDecoded {
    const config = super.parseLocalConfig(projectDirectory);

    /**
     * This is a temporary hack to maintain compatibilty with the PowerSync Dashboard.
     * The dashboard requires replication connections to have a name field set.
     * This is not enforced by the management service.
     */
    for (const [index, connection] of config.replication?.connections?.entries() ?? []) {
      if (!connection.name) {
        connection.name = `Default${index > 0 ? `_${index}` : ''}`;
      }
    }

    return config;
  }

  protected async provision(params: {
    cloudConfigState: routes.InstanceConfigResponse;
    deployTimeoutMs: number;
    indentationLevel: number;
  }): Promise<void> {
    const { cloudConfigState, deployTimeoutMs, indentationLevel } = params;

    const indentation = '\t'.repeat(Math.max(0, indentationLevel));
    const spinner = ora({
      discardStdin: false,
      prefixText: `\n${indentation}Initial provision: deploying without sync config changes in order to validate sync config before final deploy...\n`,
      spinner: 'moon',
      suffixText: `\n${indentation}This may take a few minutes.\n`
    });

    spinner.start();

    try {
      const deployResult = await this.deployInstanceConfig({
        cloudConfigState,
        updateSyncConfig: false
      });

      await this.waitForDeployCompletion({
        deployResult,
        indentation,
        logCompletionMessage: false,
        logScheduledMessage: false,
        timeoutMs: deployTimeoutMs
      });

      spinner.stop();
    } catch (error) {
      spinner.stop();
      const { linked } = this.project;

      this.styledError({
        error,
        message: `Failed to deploy changes to instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`,
        suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
      });
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

  protected async waitForDeployCompletion(params: {
    deployResult: routes.DeployInstanceResponse;
    indentation?: string;
    logCompletionMessage?: boolean;
    logScheduledMessage?: boolean;
    timeoutMs: number;
  }): Promise<void> {
    const {
      deployResult,
      indentation = '',
      logCompletionMessage = true,
      logScheduledMessage = true,
      timeoutMs
    } = params;
    const { client, project } = this;

    if (logScheduledMessage) {
      this.log(`${indentation}Deploy operation has been scheduled. Waiting for completion...`);
    }

    const status = await waitForOperationStatusChange({
      client,
      instanceId: deployResult.id,
      linked: project.linked,
      operationId: deployResult.operation_id,
      timeoutMs
    });

    if (status === 'completed') {
      if (!logCompletionMessage) {
        return;
      }

      this.log(ux.colorize('green', 'Deployment operation completed successfully!'));
    } else {
      this.styledError({
        message: `Deploy failed. Check instance diagnostics for details, for example: ${ux.colorize('blue', 'powersync status')}`
      });
    }
  }

  protected async withDeploy(timeoutMs: number, fn: () => Promise<routes.DeployInstanceResponse>): Promise<void> {
    const { project } = this;

    const spinner = ora({
      discardStdin: false,
      prefixText: '\nDeploying instance...\n',
      spinner: 'moon',
      suffixText: '\nThis may take a few minutes.\n'
    });

    spinner.start();

    try {
      const deployResult = await fn();
      await this.waitForDeployCompletion({ deployResult, timeoutMs });
      spinner.stop();
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
