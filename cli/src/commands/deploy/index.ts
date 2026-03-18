import { ux } from '@oclif/core';

import { DEFAULT_DEPLOY_TIMEOUT_MS } from '../../api/cloud/wait-for-operation.js';
import { DeployCommandBaseWithSyncPath } from './deploy-with-sync-base.js';

/**
 * Deploys the sync config and service configuration
 */
export default class DeployAll extends DeployCommandBaseWithSyncPath {
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
    ...DeployCommandBaseWithSyncPath.flags
  };
  static summary = '[Cloud only] Deploy local config to the linked Cloud instance (connections + auth + sync config).';

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployAll);

    const project = await this.loadProject(flags, {
      configFileRequired: true
    });

    const deployTimeoutMs = (flags['deploy-timeout'] ?? DEFAULT_DEPLOY_TIMEOUT_MS / 1000) * 1000;

    this.parseLocalConfig(project.projectDirectory);

    const cloudConfigState = await this.loadCloudConfigState();

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

    await this.validateSyncConfig();

    this.log('Validations completed successfully.\n');

    await this.deployAll({ cloudConfigState, deployTimeoutMs, updateSyncConfig: syncConfigHasChanges });
  }
}
