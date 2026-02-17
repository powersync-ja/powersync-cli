import { Flags, ux } from '@oclif/core';
import {
  CloudProject,
  createCloudClient,
  createSelfHostedClient,
  parseYamlFile,
  SelfHostedProject,
  SERVICE_FILENAME,
  SharedInstanceCommand,
  SYNC_FILENAME
} from '@powersync/cli-core';
import { ServiceCloudConfig, ServiceCloudConfigDecoded, ServiceSelfHostedConfig } from '@powersync/cli-schemas';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ora from 'ora';
import { Document } from 'yaml';
import { testCloudConnections } from '../api/cloud/test-connection.js';

/** Result from a single test run (name comes from the entry). */
type ValidationTestRunResult = {
  passed: boolean;
  errors?: string[];
};

type ValidationTestResult = ValidationTestRunResult & {
  name: string;
};

type ValidationResult = {
  passed: boolean;
  tests: ValidationTestResult[];
};

/** Test definition: name and a function that returns a promise of the result. */
type ValidationTestDef = {
  name: string;
  run: () => Promise<ValidationTestRunResult>;
};

/** Test entry with optional result (set when promise settles). */
type ValidationTestEntry = {
  name: string;
  promise: Promise<ValidationTestRunResult>;
  result?: ValidationTestRunResult;
};

const INDENT = '  ';
const BULLET = '•';

enum Tests {
  CONFIGURATION_SCHEMA = 'Validate Configuration Schema',
  TEST_CONNECTIONS = 'Test Connections',
  SYNC_RULES = 'Validate Sync Rules'
}

function formatOraMessage(entries: ValidationTestEntry[]): string {
  return entries
    .map((e) => (e.result === undefined ? `\t... ${e.name}` : e.result.passed ? `\t✓ ${e.name}` : `\t✗ ${e.name}`))
    .join('\n');
}

function formatTestHuman(test: ValidationTestResult): string {
  const status = test.passed ? '✓' : '✗';
  const name = `${status} ${test.name}`;
  if (test.passed) return name;
  const errorLines = (test.errors ?? []).map((e) => `${INDENT}${BULLET} ${e}`);
  return [name, ...errorLines].join('\n');
}

function formatValidationHuman(result: ValidationResult): string {
  const header = result.passed ? 'All validation tests passed.' : 'Some validation tests failed.';
  const lines = [header, '', ...result.tests.map(formatTestHuman)];
  return lines.join('\n');
}

function formatValidationJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}

function formatValidationYaml(result: ValidationResult): string {
  return new Document(result).toString();
}

async function runConfigTest(projectDir: string, isCloud: boolean): Promise<ValidationTestRunResult> {
  const servicePath = join(projectDir, SERVICE_FILENAME);
  try {
    const doc = parseYamlFile(servicePath);
    const raw = doc.contents?.toJSON();
    if (isCloud) {
      ServiceCloudConfig.decode(raw);
    } else {
      ServiceSelfHostedConfig.decode(raw);
    }
    return { passed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { passed: false, errors: [message] };
  }
}

async function runSyncRulesTestCloud(project: CloudProject): Promise<ValidationTestRunResult> {
  const syncRulesPath = join(project.projectDirectory, SYNC_FILENAME);
  const syncRulesContent =
    project.syncRulesContent ?? (existsSync(syncRulesPath) ? readFileSync(syncRulesPath, 'utf8') : undefined);
  if (!syncRulesContent?.trim()) {
    return { passed: false, errors: ['No sync.yaml found or empty.'] };
  }
  const client = await createCloudClient();
  try {
    const result = await client.validateSyncRules({
      id: project.linked.instance_id,
      org_id: project.linked.org_id,
      app_id: project.linked.project_id,
      sync_rules: syncRulesContent
    });
    const hasFatalErrors = (result.connections ?? []).some((c) =>
      (c.tables ?? []).some((t) => (t.errors ?? []).some((e) => e.level === 'fatal'))
    );
    const passed = !hasFatalErrors;
    const errors = (result.connections ?? []).flatMap((c) =>
      (c.tables ?? []).flatMap((t) => (t.errors ?? []).map((e) => `${t.schema}.${t.name}: [${e.level}] ${e.message}`))
    );
    return {
      passed,
      errors: errors.length ? errors : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { passed: false, errors: [message] };
  }
}

async function runSyncRulesTestSelfHosted(project: SelfHostedProject): Promise<ValidationTestRunResult> {
  const syncRulesPath = join(project.projectDirectory, SYNC_FILENAME);
  const syncRulesContent = existsSync(syncRulesPath) ? readFileSync(syncRulesPath, 'utf8') : undefined;
  if (!syncRulesContent?.trim()) {
    return { passed: false, errors: ['No sync.yaml found or empty.'] };
  }
  const client = createSelfHostedClient({
    apiUrl: project.linked.api_url,
    apiKey: project.linked.api_key
  });
  try {
    const result = await client.validate({ sync_rules: syncRulesContent });
    const hasFatalErrors = (result.connections ?? []).some((c) =>
      (c.tables ?? []).some((t) => (t.errors ?? []).some((e) => e.level === 'fatal'))
    );
    const passed = !hasFatalErrors;
    const errors = (result.connections ?? []).flatMap((c) =>
      (c.tables ?? []).flatMap((t) => (t.errors ?? []).map((e) => `${t.schema}.${t.name}: [${e.level}] ${e.message}`))
    );
    return {
      passed,
      errors: errors.length ? errors : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { passed: false, errors: [message] };
  }
}

export default class Validate extends SharedInstanceCommand {
  static description =
    'Run validation checks on local config: config schema, database connections, and sync rules. Requires a linked instance. Works with Cloud and self-hosted.';
  static summary = 'Validate config schema, connections, and sync rules before deploy.';

  static flags = {
    output: Flags.string({
      default: 'human',
      description: 'Output format: human-readable, json, or yaml.',
      options: ['human', 'json', 'yaml']
    }),
    ...SharedInstanceCommand.flags
  };

  async runConnectionTestCloud(project: CloudProject): Promise<ValidationTestRunResult> {
    const client = await createCloudClient();
    let config: ServiceCloudConfigDecoded;
    try {
      config = this.parseCloudConfig(project.projectDirectory);
    } catch (error) {
      return {
        passed: false,
        errors: [`Could not parse config: ${error}`]
      };
    }
    const connections = config.replication?.connections ?? [];
    if (connections.length === 0) {
      return { passed: false, errors: ['No connections defined in config.'] };
    }
    try {
      const results = await testCloudConnections(client, project.linked, connections);
      const failed = results.filter((r) => r.response.success !== true);
      if (failed.length === 0) {
        return { passed: true };
      }
      const errors = failed.map((f) => `${f.connectionName}: ${f.response.error ?? 'Connection test failed'}`);
      return { passed: false, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { passed: false, errors: [message] };
    }
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);

    const project = await this.loadProject(flags, {
      configFileRequired: true
    });

    const isCloud = project.linked.type === 'cloud';

    const testDefs: ValidationTestDef[] = [
      { name: Tests.CONFIGURATION_SCHEMA, run: () => runConfigTest(project.projectDirectory, isCloud) },
      ...(isCloud
        ? [
            { name: Tests.TEST_CONNECTIONS, run: () => this.runConnectionTestCloud(project as CloudProject) },
            { name: Tests.SYNC_RULES, run: () => runSyncRulesTestCloud(project as CloudProject) }
          ]
        : [{ name: Tests.SYNC_RULES, run: () => runSyncRulesTestSelfHosted(project as SelfHostedProject) }])
    ];

    const testEntries: ValidationTestEntry[] = testDefs.map((def) => ({
      name: def.name,
      promise: def.run()
    }));

    let result: ValidationResult;

    if (flags.output === 'json') {
      const runResults = await Promise.all(testEntries.map((e) => e.promise));
      const tests: ValidationTestResult[] = testEntries.map((e, i) => ({ name: e.name, ...runResults[i] }));
      result = { passed: tests.every((t) => t.passed), tests };
      this.log(ux.colorize('gray', formatValidationJson(result)));
    } else if (flags.output === 'yaml') {
      const runResults = await Promise.all(testEntries.map((e) => e.promise));
      const tests: ValidationTestResult[] = testEntries.map((e, i) => ({ name: e.name, ...runResults[i] }));
      result = { passed: tests.every((t) => t.passed), tests };
      this.log(ux.colorize('gray', formatValidationYaml(result)));
    } else if (flags.output === 'human') {
      this.log('Running validation tests...');

      const spinner = ora({ text: formatOraMessage(testEntries) }).start();
      const promises = testEntries.map((entry, i) =>
        entry.promise
          .then((res) => {
            testEntries[i].result = res;
            spinner.text = formatOraMessage(testEntries);
            return res;
          })
          .catch((err) => {
            testEntries[i].result = { passed: false, errors: [String(err)] };
            spinner.text = formatOraMessage(testEntries);
            throw err;
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
        if (test.passed) {
          this.log(ux.colorize('green', `✓ ${test.name}`));
        } else {
          this.log(`✗ ${test.name}`);
          for (const error of test.errors ?? []) {
            this.log(ux.colorize('red', `${INDENT}${BULLET} ${error}`));
          }
          this.log('');
        }
      }
    } else {
      const runResults = await Promise.all(testEntries.map((e) => e.promise));
      const tests: ValidationTestResult[] = testEntries.map((e, i) => ({ name: e.name, ...runResults[i] }));
      result = { passed: tests.every((t) => t.passed), tests };
      this.log(ux.colorize('gray', formatValidationHuman(result)));
    }

    if (!result.passed) {
      this.exit(1);
    }
  }
}
