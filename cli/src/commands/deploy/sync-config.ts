import { ux } from '@oclif/core/ux';
import { routes } from '@powersync/management-types';

import DeployAll from './index.js';

export class DeploySyncConfig extends DeployAll {
  static description = 'Deploy only sync config changes.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<id>'
  ];
  static flags = {
    ...DeployAll.flags
  };
  static summary = '[Cloud only] Deploy local sync config to the linked Cloud instance.';

  /**
   * Deploys only the sync config.
   * Uses existing cloud config state for other fields.
   */
  protected async deploySyncConfig(params: {
    cloudConfigState: routes.InstanceConfigResponse;
    timeout: number;
  }): Promise<void> {
    const { cloudConfigState, timeout } = params;
    const { project } = this;
    const { linked } = project;

    const { syncRulesContent } = project;
    if (!syncRulesContent) {
      this.styledError({
        message: `Sync config content not loaded. Ensure sync config is present and valid.`
      });
    }

    if (!cloudConfigState.config) {
      this.styledError({
        message: `No existing cloud config found for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}. A config must be deployed before deploying sync config changes.`,
        suggestions: [`Run ${ux.colorize('blue', 'powersync deploy')} to deploy the initial config.`]
      });
    }

    return this.withDeploy(timeout, async () =>
      this.client.deployInstance(
        routes.DeployInstanceRequest.encode({
          ...cloudConfigState,
          app_id: linked.project_id,
          config: cloudConfigState.config!,
          id: linked.instance_id,
          org_id: linked.org_id,
          sync_rules: syncRulesContent
        })
      )
    );
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployAll);

    const project = await this.loadProject(flags, {
      // We don't need the config to be managed locally for this
      configFileRequired: false
    });

    const { linked } = project;
    this.parseConfig(project.projectDirectory);

    // The existing config is required to deploy changes. The instance should have been created already.
    const cloudConfigState = await this.loadCloudConfigState();

    // We use the cloud config as the "local config for this"
    this.serviceConfig = {
      _type: linked.type,
      name: cloudConfigState.name,
      region: cloudConfigState.config!.region!,
      ...cloudConfigState.config,
      ...linked
    };
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

    if (!instanceStatus.provisioned) {
      this.log(
        `The instance is not currently provisioned. Triggering a deploy in order to reprovision. This may take a few minutes.`
      );
      // Don't yet update the sync config since the instance is not provisioned, but deploy to trigger provisioning
      await this.deployAll({ cloudConfigState, deployTimeoutMs: flags.timeout, updateSyncConfig: false });
    }

    // Validate sync config
    this.log('\tValidating sync config...');
    await this.validateSyncConfig();

    this.log('Validations completed successfully.\n');

    await this.deploySyncConfig({ cloudConfigState, timeout: flags.timeout });
  }
}
