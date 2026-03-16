import { Flags } from '@oclif/core';
import { CloudProject, SelfHostedProject, SharedInstanceCommand, ValidationResult } from '@powersync/cli-core';

import { getCloudValidations } from '../api/validations/cloud-validations.js';
import { getSelfHostedValidationTests } from '../api/validations/self-hosted-validations.js';
import { GENERAL_VALIDATION_FLAG_HELPERS } from '../api/validations/validation-flags.js';
import { formatValidationJson, formatValidationYaml } from '../api/validations/validation-utils.js';
import { ValidationsRunner } from '../api/validations/ValidationsRunner.js';

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
      configFileRequired: true
    });

    const isCloud = project.linked.type === 'cloud';
    const validationTestsFilter = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags(flags);
    const testEntries = isCloud
      ? getCloudValidations({ project: project as CloudProject, tests: validationTestsFilter.testsToRun })
      : getSelfHostedValidationTests({
          project: project as SelfHostedProject,
          tests: validationTestsFilter.testsToRun
        });

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
