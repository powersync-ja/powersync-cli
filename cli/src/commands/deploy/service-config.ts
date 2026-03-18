import BaseDeployCommand from '../../api/BaseDeployCommand.js';
import { DEFAULT_DEPLOY_TIMEOUT_MS } from '../../api/cloud/wait-for-operation.js';
import { getCloudValidations } from '../../api/validations/cloud-validations.js';
import { generateValidationTestFlags } from '../../api/validations/validation-flags.js';
import { ValidationsRunner } from '../../api/validations/ValidationsRunner.js';
import { ValidationTest } from '../../api/validations/ValidationTestDefinition.js';

const SERVICE_CONFIG_VALIDATION_FLAGS = generateValidationTestFlags({
  // No sync config validation for this command
  limitOptions: [ValidationTest.CONFIGURATION, ValidationTest.CONNECTIONS]
});

export default class DeployServiceConfig extends BaseDeployCommand {
  static description = 'Deploy only service config changes (without sync config updates).';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<id>'
  ];
  static flags = {
    ...SERVICE_CONFIG_VALIDATION_FLAGS.flags,
    ...BaseDeployCommand.flags
  };
  static summary = '[Cloud only] Deploy only local service config to the linked Cloud instance.';

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployServiceConfig);

    const project = await this.loadProject(flags, {
      // local service config is required for this command
      configFileRequired: true
    });

    const deployTimeoutMs = (flags['deploy-timeout'] ?? DEFAULT_DEPLOY_TIMEOUT_MS / 1000) * 1000;

    const validationsFilter = SERVICE_CONFIG_VALIDATION_FLAGS.parseValidationTestFlags(flags);

    // Parse and store for later
    this.parseLocalConfig(project.projectDirectory, validationsFilter.skipped.includes(ValidationTest.CONFIGURATION));

    // The existing config is required to deploy changes. The instance should have been created already.
    const cloudConfigState = await this.loadCloudConfigState();

    this.log('Performing validations before deploy...');
    const validationRunner = new ValidationsRunner({
      skippedTests: validationsFilter.skipped,
      tests: getCloudValidations({
        cloudConfigState,
        project,
        serviceConfigState: this.serviceConfig!,
        tests: validationsFilter.testsToRun
      })
    });

    const result = await validationRunner.runWithProgress({ printSummary: (summary) => this.log(summary) });
    if (!result.passed) {
      this.styledError({
        message: 'Validation tests failed. Fix the issues and try deploying again.',
        suggestions: ['Review the validation test results above, fix any issues, and run deploy again.']
      });
    }

    await this.deployAll({ cloudConfigState, deployTimeoutMs, updateSyncConfig: false });
  }
}
