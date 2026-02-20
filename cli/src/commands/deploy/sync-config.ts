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
  protected async deploySyncConfig(params: { cloudConfigState: routes.InstanceConfigResponse }): Promise<void> {
    const { cloudConfigState } = params;
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

    return this.withDeploy(async () =>
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

    this.parseConfig(project.projectDirectory);

    // The existing config is required to deploy changes. The instance should have been created already.
    const cloudConfigState = await this.loadCloudConfigState();

    this.log('Performing validations before deploy...');

    // Validate sync config
    await this.validateSyncConfig();

    this.log('Validations completed successfully.\n');

    await this.deploySyncConfig({ cloudConfigState });
  }
}
