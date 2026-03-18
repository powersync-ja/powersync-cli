import { DEFAULT_DEPLOY_TIMEOUT_MS } from '../../api/cloud/wait-for-operation.js';
import DeployCommandBase from './deploy-command-base.js';

export default class DeployServiceConfig extends DeployCommandBase {
  static description = 'Deploy only service config changes (without sync config updates).';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<id>'
  ];
  static flags = {
    ...DeployCommandBase.flags
  };
  static summary = '[Cloud only] Deploy only local service config to the linked Cloud instance.';

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployServiceConfig);

    const project = await this.loadProject(flags, {
      // local service config is required for this command
      configFileRequired: true
    });

    const deployTimeoutMs = (flags['deploy-timeout'] ?? DEFAULT_DEPLOY_TIMEOUT_MS / 1000) * 1000;

    // Parse and store for later
    this.parseLocalConfig(project.projectDirectory);

    // The existing config is required to deploy changes. The instance should have been created already.
    const cloudConfigState = await this.loadCloudConfigState();

    this.log('Performing validations before deploy...');
    await this.validateServiceConfig({ cloudConfigState });
    await this.testConnections();

    this.log('Validations completed successfully.\n');

    await this.deployAll({ cloudConfigState, deployTimeoutMs, updateSyncConfig: false });
  }
}
