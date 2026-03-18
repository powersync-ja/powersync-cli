import { Flags } from '@oclif/core';
import { CloudProject, SelfHostedProject, SharedInstanceCommand, ValidationResult } from '@powersync/cli-core';

import { parseLocalCloudServiceConfig } from '../api/parse-local-cloud-service-config.js';
import { getCloudValidations } from '../api/validations/cloud-validations.js';
import { getSelfHostedValidationTests } from '../api/validations/self-hosted-validations.js';
import { GENERAL_VALIDATION_FLAG_HELPERS } from '../api/validations/validation-flags.js';
import { formatValidationJson, formatValidationYaml } from '../api/validations/validation-utils.js';
import { ValidationsRunner } from '../api/validations/ValidationsRunner.js';
import { ValidationTest } from '../api/validations/ValidationTestDefinition.js';

export default class Validate extends SharedInstanceCommand {
  static description =
    'Run validation checks on local config: config schema, database connections, and sync config. Requires a linked instance. Works with Cloud and self-hosted.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --output=json',
    '<%= config.bin %> <%= command.id %> --api-url=https://powersync.example.com'
  ];
  static flags = {
    output: Flags.string({
      default: 'human',
      description: 'Output format: human-readable, json, or yaml.',
      options: ['human', 'json', 'yaml']
    }),
    ...GENERAL_VALIDATION_FLAG_HELPERS.flags,
    ...SharedInstanceCommand.flags
  };
  static summary = 'Validate config schema, connections, and sync config before deploy.';

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);

    const project = await this.loadProject(flags, {
      // The config file is not required if a user only wants to validate sync config
      configFileRequired: false
    });

    const isCloud = project.linked.type === 'cloud';
    const validationTestsFilter = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags(flags);

    let testEntries;
    if (isCloud) {
      const cloudProject = project as CloudProject;
      const { linked } = cloudProject;
      const cloudConfigState = await this.cloudClient
        .getInstanceConfig({ app_id: linked.project_id, id: linked.instance_id, org_id: linked.org_id })
        .catch((error) => {
          this.styledError({
            error,
            message: `Failed to get config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}.`,
            suggestions: ['Check your network connection and try again.', 'If the problem persists, contact support.']
          });
        });
      const serviceConfigState = parseLocalCloudServiceConfig(
        cloudProject.projectDirectory,
        validationTestsFilter.skipped.includes(ValidationTest.CONFIGURATION)
      );
      testEntries = getCloudValidations({
        cloudConfigState,
        project: cloudProject,
        serviceConfigState,
        tests: validationTestsFilter.testsToRun
      });
    } else {
      testEntries = getSelfHostedValidationTests({
        project: project as SelfHostedProject,
        tests: validationTestsFilter.testsToRun
      });
    }

    const runner = new ValidationsRunner({
      skippedTests: validationTestsFilter.skipped,
      tests: testEntries
    });

    let result: ValidationResult;

    switch (flags.output) {
      case 'json': {
        result = await runner.run();
        this.log(formatValidationJson(result));
        break;
      }

      case 'yaml': {
        result = await runner.run();
        this.log(formatValidationYaml(result));
        break;
      }

      default: {
        this.log('Running validation tests...');
        result = await runner.runWithProgress({ printSummary: (summary) => this.log(summary) });
      }
    }

    if (!result.passed) {
      this.exit(1);
    }
  }
}
