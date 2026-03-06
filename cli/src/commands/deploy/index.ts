import { ux } from '@oclif/core';

import BaseDeployCommand, { SKIP_SYNC_CONFIG_VALIDATION_FLAG } from '../../api/BaseDeployCommand.js';
import { DEFAULT_DEPLOY_TIMEOUT_MS } from '../../api/cloud/wait-for-operation.js';

export default class DeployAll extends BaseDeployCommand {
  static description = [
    'Deploy local config (service.yaml, sync config) to the linked PowerSync Cloud instance.',
    'Validates connections and sync config before deploying.',
    `See also ${ux.colorize('blue', 'powersync deploy sync-config')} to deploy only sync config changes.`,
    `See also ${ux.colorize('blue', 'powersync deploy service-config')} to deploy only service config changes.`
  ].join('\n');
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<id>'
  ];
  static flags = {
    ...BaseDeployCommand.flags,
    ...SKIP_SYNC_CONFIG_VALIDATION_FLAG
  };
  static summary = '[Cloud only] Deploy local config to the linked Cloud instance (connections + auth + sync config).';

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployAll);

    const project = await this.loadProject(flags, {
      // local config state is required when deploying all
      configFileRequired: true
    });

    const deployTimeoutMs = (flags['deploy-timeout'] ?? DEFAULT_DEPLOY_TIMEOUT_MS / 1000) * 1000;

    // Parse and store for later
    this.parseLocalConfig(project.projectDirectory);

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

    if (flags['skip-sync-config-validation']) {
      this.log(ux.colorize('yellow', '\tSkipping sync config validation.'));
    } else {
      /**
       * At this point we know the instances is deprovisioned, and the current config is valid.
       * We can't verify the sync config yet - since that requires a provisioned instance.
       * We will attempt to deploy the config without the sync config first,
       * if that succeeds, then we will validate the sync config and deploy again with the sync config.
       */
      if (requiresReprovision) {
        this.log(
          [
            `The instance is ${ux.colorize('yellow', 'not currently provisioned')} and we have detected changes to the sync config.`,
            `To ensure the instance is successfully provisioned with a valid config, we will first deploy without the sync config, then validate and deploy again with the sync config.`
          ].join('\n')
        );

        await this.provision({
          cloudConfigState,
          deployTimeoutMs,
          indentationLevel: 1
        });
      }

      this.log('\tValidating sync config...');
      await this.validateSyncConfig();
    }

    this.log('Validations completed successfully.\n');

    await this.deployAll({ cloudConfigState, deployTimeoutMs, updateSyncConfig: syncConfigHasChanges });
  }
}
