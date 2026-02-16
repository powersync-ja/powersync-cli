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
import { CLICloudConfig, CLICloudConfigDecoded, CLISelfHostedConfig } from '@powersync/cli-schemas';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document } from 'yaml';
import { testCloudConnections } from '../api/cloud/test-connection.js';

type ValidationTestResult = {
  name: string;
  passed: boolean;
  errors?: string[];
};

type ValidationResult = {
  passed: boolean;
  tests: ValidationTestResult[];
};

const INDENT = '  ';
const BULLET = '•';

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

async function runConfigTest(projectDir: string, isCloud: boolean): Promise<ValidationTestResult> {
  const servicePath = join(projectDir, SERVICE_FILENAME);
  try {
    const doc = parseYamlFile(servicePath);
    const raw = doc.contents?.toJSON();
    if (isCloud) {
      CLICloudConfig.decode(raw);
    } else {
      CLISelfHostedConfig.decode(raw);
    }
    return { name: 'config_schema', passed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name: 'config_schema', passed: false, errors: [message] };
  }
}

async function runSyncRulesTestCloud(project: CloudProject): Promise<ValidationTestResult> {
  const syncRulesPath = join(project.projectDirectory, SYNC_FILENAME);
  const syncRulesContent =
    project.syncRulesContent ?? (existsSync(syncRulesPath) ? readFileSync(syncRulesPath, 'utf8') : undefined);
  if (!syncRulesContent?.trim()) {
    return { name: 'sync_rules', passed: false, errors: ['No sync.yaml found or empty.'] };
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
      name: 'sync_rules',
      passed,
      errors: errors.length ? errors : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name: 'sync_rules', passed: false, errors: [message] };
  }
}

async function runSyncRulesTestSelfHosted(project: SelfHostedProject): Promise<ValidationTestResult> {
  const syncRulesPath = join(project.projectDirectory, SYNC_FILENAME);
  const syncRulesContent = existsSync(syncRulesPath) ? readFileSync(syncRulesPath, 'utf8') : undefined;
  if (!syncRulesContent?.trim()) {
    return { name: 'sync_rules', passed: false, errors: ['No sync.yaml found or empty.'] };
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
      name: 'sync_rules',
      passed,
      errors: errors.length ? errors : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name: 'sync_rules', passed: false, errors: [message] };
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

  async runConnectionTestCloud(project: CloudProject): Promise<ValidationTestResult> {
    const client = await createCloudClient();
    let config: CLICloudConfigDecoded;
    try {
      config = this.parseCloudConfig(project.projectDirectory);
    } catch (error) {
      return {
        name: 'connection',
        passed: false,
        errors: [`Could not parse config: ${error}`]
      };
    }
    const connections = config.replication?.connections ?? [];
    if (connections.length === 0) {
      return { name: 'connection', passed: false, errors: ['No connections defined in config.'] };
    }
    try {
      const results = await testCloudConnections(client, project.linked, connections);
      const failed = results.filter((r) => r.response.success !== true);
      if (failed.length === 0) {
        return { name: 'connection', passed: true };
      }
      const errors = failed.map((f) => `${f.connectionName}: ${f.response.error ?? 'Connection test failed'}`);
      return { name: 'connection', passed: false, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { name: 'connection', passed: false, errors: [message] };
    }
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);

    const project = this.loadProject(flags, {
      configFileRequired: true
    });

    const isCloud = project.linked.type === 'cloud';
    const tests: ValidationTestResult[] = [];

    tests.push(await runConfigTest(project.projectDirectory, isCloud));

    if (isCloud) {
      tests.push(await this.runConnectionTestCloud(project as CloudProject));
      tests.push(await runSyncRulesTestCloud(project as CloudProject));
    } else {
      tests.push(await runSyncRulesTestSelfHosted(project as SelfHostedProject));
    }

    const result: ValidationResult = {
      passed: tests.every((t) => t.passed),
      tests
    };

    if (flags.output === 'json') {
      this.log(ux.colorize('gray', formatValidationJson(result)));
    } else if (flags.output === 'yaml') {
      this.log(ux.colorize('gray', formatValidationYaml(result)));
    } else {
      this.log(ux.colorize('gray', formatValidationHuman(result)));
    }

    if (!result.passed) {
      this.exit(1);
    }
  }
}
