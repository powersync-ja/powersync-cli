import { Flags, ux } from '@oclif/core';
import {
  CloudProject,
  createCloudClient,
  SelfHostedProject,
  SharedInstanceCommand,
  ValidationResult,
  ValidationTestResult,
  ValidationTestRunResult
} from '@powersync/cli-core';
import { ServiceCloudConfigDecoded } from '@powersync/cli-schemas';
import ora from 'ora';

import { testCloudConnections } from '../api/cloud/test-connection.js';
import {
  BULLET,
  formatOraMessage,
  formatValidationHuman,
  formatValidationJson,
  formatValidationYaml,
  INDENT,
  renderWarningForHumanOutput,
  runConfigTest,
  runSyncConfigTestCloud,
  runSyncConfigTestSelfHosted,
  ValidationTest,
  type ValidationTestDef,
  type ValidationTestEntry
} from '../api/run-validation-tests.js';

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
    ...SharedInstanceCommand.flags
  };
  static summary = 'Validate config schema, connections, and sync config before deploy.';

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);

    const project = await this.loadProject(flags, {
      configFileRequired: true
    });

    const isCloud = project.linked.type === 'cloud';

    const testDefs: ValidationTestDef[] = [
      { name: ValidationTest['CONFIGURATION-SCHEMA'], run: () => runConfigTest(project.projectDirectory, isCloud) },
      ...(isCloud
        ? [
            { name: ValidationTest.CONNECTIONS, run: () => this.runConnectionTestCloud(project as CloudProject) },
            {
              name: ValidationTest['SYNC-CONFIG'],
              async run() {
                // We can only validate sync rules against a provisioned instance, so ensure that's the case before running the test.
                const client = createCloudClient();
                const cloudProject = project as CloudProject;

                const status = await client.getInstanceStatus({
                  app_id: cloudProject.linked.project_id,
                  id: cloudProject.linked.instance_id,
                  org_id: cloudProject.linked.org_id
                });
                if (!status.provisioned) {
                  return {
                    errors: [
                      `Linked instance is not provisioned. Sync config validation requires a provisioned instance.`,
                      `Deploy the instance, with ${ux.colorize('blue', 'powersync deploy')}, before validating sync config.`
                    ],
                    passed: false
                  };
                }

                return runSyncConfigTestCloud(project as CloudProject);
              }
            }
          ]
        : [
            {
              name: ValidationTest['SYNC-CONFIG'],
              run: () => runSyncConfigTestSelfHosted(project as SelfHostedProject)
            }
          ])
    ];

    const testEntries: ValidationTestEntry[] = testDefs.map((def) => ({
      name: def.name,
      promise: def.run()
    }));

    let result: ValidationResult;

    switch (flags.output) {
      case 'human': {
        this.log('Running validation tests...');

        const spinner = ora({ discardStdin: false, text: formatOraMessage(testEntries) }).start();
        const promises = testEntries.map((entry, i) =>
          entry.promise
            .then((res) => {
              testEntries[i].result = res;
              return res;
            })
            .catch((error) => {
              // Capture the failure so the spinner can complete and we can report all results together.
              testEntries[i].result = { errors: [String(error)], passed: false };
              return testEntries[i].result;
            })
            .finally(() => {
              spinner.text = formatOraMessage(testEntries);
            })
        );
        await Promise.all(promises);
        const tests: ValidationTestResult[] = testEntries.map((e) => ({ name: e.name, ...e.result! }));
        result = { passed: tests.every((t) => t.passed), tests };
        spinner.stop();
        this.log(
          result.passed
            ? ux.colorize('green', 'All validation tests passed.')
            : ux.colorize('red', 'Some validation tests failed:\n')
        );

        for (const test of result.tests) {
          const status = test.passed ? '✓' : '✗';
          this.log(`${status} ${ux.colorize('blue', test.name)}`);

          const warnings = test.warnings ?? [];
          for (const [index, warning] of warnings.entries()) {
            const warningLines = renderWarningForHumanOutput(warning);
            for (const line of warningLines) {
              this.log(line);
            }

            if (index < warnings.length - 1) {
              this.log('');
            }
          }

          for (const error of test.errors ?? []) {
            this.log(ux.colorize('red', `${INDENT}${BULLET} ${error}`));
          }

          if ((test.warnings?.length ?? 0) > 0 || (test.errors?.length ?? 0) > 0) {
            this.log('');
          }
        }

        break;
      }

      case 'json': {
        const runResults = await Promise.all(
          testEntries.map((e) =>
            e.promise.catch((error): ValidationTestRunResult => ({ errors: [String(error)], passed: false }))
          )
        );
        const tests: ValidationTestResult[] = testEntries.map((e, i) => ({ name: e.name, ...runResults[i] }));
        result = { passed: tests.every((t) => t.passed), tests };
        this.log(formatValidationJson(result));

        break;
      }

      case 'yaml': {
        const runResults = await Promise.all(
          testEntries.map((e) =>
            e.promise.catch((error): ValidationTestRunResult => ({ errors: [String(error)], passed: false }))
          )
        );
        const tests: ValidationTestResult[] = testEntries.map((e, i) => ({ name: e.name, ...runResults[i] }));
        result = { passed: tests.every((t) => t.passed), tests };
        this.log(formatValidationYaml(result));

        break;
      }

      default: {
        const runResults = await Promise.all(
          testEntries.map((e) =>
            e.promise.catch((error): ValidationTestRunResult => ({ errors: [String(error)], passed: false }))
          )
        );
        const tests: ValidationTestResult[] = testEntries.map((e, i) => ({ name: e.name, ...runResults[i] }));
        result = { passed: tests.every((t) => t.passed), tests };
        this.log(formatValidationHuman(result));
      }
    }

    if (!result.passed) {
      this.exit(1);
    }
  }

  async runConnectionTestCloud(project: CloudProject): Promise<ValidationTestRunResult> {
    const client = createCloudClient();
    let config: ServiceCloudConfigDecoded;
    try {
      config = this.parseCloudConfig(project.projectDirectory);
    } catch (error) {
      return {
        errors: [`Could not parse config: ${error}`],
        passed: false
      };
    }

    const connections = config.replication?.connections ?? [];
    if (connections.length === 0) {
      return { errors: ['No connections defined in config.'], passed: false };
    }

    try {
      const results = await testCloudConnections(client, project.linked, connections);
      const failed = results.filter((r) => r.response.success !== true);
      if (failed.length === 0) {
        return { passed: true };
      }

      const errors = failed.map((f) => `${f.connectionName}: ${f.response.error ?? 'Connection test failed'}`);
      return { errors, passed: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { errors: [message], passed: false };
    }
  }
}
