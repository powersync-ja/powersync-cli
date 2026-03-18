import { ux } from '@oclif/core';

import BaseDeployCommand from '../../api/BaseDeployCommand.js';
import { DEFAULT_DEPLOY_TIMEOUT_MS } from '../../api/cloud/wait-for-operation.js';
import { getCloudValidations } from '../../api/validations/cloud-validations.js';
import { GENERAL_VALIDATION_FLAG_HELPERS } from '../../api/validations/validation-flags.js';
import { formatValidationHuman } from '../../api/validations/validation-utils.js';
import { ValidationsRunner } from '../../api/validations/ValidationsRunner.js';
import { ValidationTest } from '../../api/validations/ValidationTestDefinition.js';

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
    ...GENERAL_VALIDATION_FLAG_HELPERS.flags
  };
  static summary = '[Cloud only] Deploy local config to the linked Cloud instance (connections + auth + sync config).';

  async run(): Promise<void> {
    const { flags } = await this.parse(DeployAll);

    const project = await this.loadProject(flags, {
      configFileRequired: true
    });

    const deployTimeoutMs = (flags['deploy-timeout'] ?? DEFAULT_DEPLOY_TIMEOUT_MS / 1000) * 1000;

    const validationTestsFilter = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags(flags);

    const cloudConfigState = await this.loadCloudConfigState();

    // Parse and store for later
    this.parseLocalConfig(
      project.projectDirectory,
      validationTestsFilter.skipped.includes(ValidationTest.CONFIGURATION)
    );

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

    let didReprovision = false;

    if (requiresReprovision && validationTestsFilter.testsToRun.includes(ValidationTest['SYNC-CONFIG'])) {
      /**
       * The instance is deprovisioned and sync-config validation is requested.
       * Sync-config validation requires a provisioned instance, so we can't validate it yet.
       * We must first validate everything else, reprovision, and then validate sync-config separately.
       */
      const runner = new ValidationsRunner({
        skippedTests: validationTestsFilter.skipped,
        tests: getCloudValidations({
          cloudConfigState,
          project,
          serviceConfigState: this.serviceConfig!,
          // We only remove the sync-config validation, this allows users to additionally skip other validations like connections and service config.
          tests: validationTestsFilter.testsToRun.filter((test) => test !== ValidationTest['SYNC-CONFIG'])
        })
      });
      const intermediateResult = await runner.run();
      // Always print the intermediate results so the user can see those tests passed before we reprovision.
      this.log(formatValidationHuman(intermediateResult));
      if (!intermediateResult.passed) {
        this.styledError({
          message:
            'The instance is currently deprovisioned. We need to reprovision the instance to validate the sync config, but there are other validation errors that need to be fixed first.',
          suggestions: ['Review the validation test results above, fix any issues, and run deploy again.']
        });
      }

      /**
       * The non-sync-config validations passed. Reprovision now so that the instance is active
       * and we can validate the sync config against it in the second pass below.
       */
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
      didReprovision = true;
    }

    /**
     * Run the final validation pass.
     * If we reprovisioned above, all non-sync-config tests already passed and their results were
     * printed, so we only need to run SYNC-CONFIG here. We don't re-list the already-run tests
     * as skipped either — the printed intermediate results already communicated their status.
     * If no reprovision was needed, run all requested tests as normal.
     */
    const finalTestsToRun = didReprovision ? [ValidationTest['SYNC-CONFIG']] : validationTestsFilter.testsToRun;
    // Always use only the user-specified skipped tests. If we reprovisioned, all other requested tests
    // already ran and their results were printed — there's no need to re-surface them as skipped here.
    const finalSkippedTests = validationTestsFilter.skipped;

    const runner = new ValidationsRunner({
      skippedTests: finalSkippedTests,
      tests: getCloudValidations({
        cloudConfigState,
        project,
        serviceConfigState: this.serviceConfig!,
        tests: finalTestsToRun
      })
    });

    const result = await runner.runWithProgress({ printSummary: (summary) => this.log(summary) });
    if (!result.passed) {
      this.styledError({
        message: 'Validation tests failed. Fix the issues and try deploying again.',
        suggestions: ['Review the validation test results above, fix any issues, and run deploy again.']
      });
    }

    await this.deployAll({ cloudConfigState, deployTimeoutMs, updateSyncConfig: syncConfigHasChanges });
  }
}
