import { ux } from '@oclif/core';
import {
  CloudProject,
  parseYamlFile,
  SelfHostedProject,
  SERVICE_FILENAME,
  SYNC_FILENAME,
  SyncDiagnostic,
  SyncValidationTestRunResult,
  validateCloudSyncRules,
  validateSelfHostedSyncRules,
  ValidationResult,
  ValidationTestResult,
  ValidationTestRunResult
} from '@powersync/cli-core';
import { ServiceCloudConfig, ServiceSelfHostedConfig } from '@powersync/cli-schemas';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document } from 'yaml';

/** Indentation used for nested human-readable output rows. */
export const INDENT = '  ';

/** Bullet character used for list rows in human-readable output. */
export const BULLET = '•';

/**
 * Definition of a test: display name and async runner function.
 */
export type ValidationTestDefinition = {
  name: string;
  run: () => Promise<ValidationTestRunResult>;
};

/**
 * Runtime test entry, storing the in-flight promise and optional settled result.
 */
export type ValidationTestEntry = {
  name: string;
  promise: Promise<ValidationTestRunResult>;
  result?: ValidationTestRunResult;
};

/**
 * Named test buckets used by the validate command.
 */
export enum ValidationTest {
  'CONFIGURATION-SCHEMA' = 'Validate Configuration Schema',
  'CONNECTIONS' = 'Test Connections',
  'SYNC-CONFIG' = 'Validate Sync Config'
}

/**
 * Formats spinner text showing per-test progress while tests are running.
 * These logs are indeted with bullets for readability, and update in-place as each test settles to show pass/fail status.
 */
export function formatOraMessage(entries: ValidationTestEntry[]): string {
  return entries
    .map((e) => (e.result === undefined ? `\t... ${e.name}` : e.result.passed ? `\t✓ ${e.name}` : `\t✗ ${e.name}`))
    .join('\n');
}

/**
 * Formats one test result into human-readable plain text.
 */
function formatTestResultHuman(test: ValidationTestResult): string {
  const status = test.passed ? '✓' : '✗';
  const name = `${status} ${test.name}`;
  const warningLines = (test.warnings ?? []).map((warning) => `${INDENT}${BULLET} [warning] ${warning}`);
  if (test.passed && warningLines.length === 0) return name;
  const errorLines = (test.errors ?? []).map((e) => `${INDENT}${BULLET} ${e}`);
  return [name, ...warningLines, ...errorLines].join('\n');
}

/**
 * Formats suite output for `--output=human`.
 */
export function formatValidationHuman(result: ValidationResult): string {
  const header = result.passed ? 'All validation tests passed.' : 'Some validation tests failed.';
  const lines = [header, '', ...result.tests.map((test) => formatTestResultHuman(test))];
  return lines.join('\n');
}

/**
 * Formats suite output for `--output=json`.
 */
export function formatValidationJson(result: ValidationResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Formats suite output for `--output=yaml`.
 */
export function formatValidationYaml(result: ValidationResult): string {
  return new Document(result).toString();
}

/**
 * Builds a two-line diagnostic message containing a source fragment and location-prefixed message.
 */
function formatSyncDiagnosticMessage(diagnostic: SyncDiagnostic, syncRulesContent: string): string {
  const lineText = getLineAt(syncRulesContent, diagnostic.startLine);
  const fragment = getLineFragment(lineText, diagnostic.startColumn);

  return `${fragment}\n${diagnostic.startLine}:${diagnostic.startColumn} ${diagnostic.message}`;
}

/**
 * Retrieves a specific 1-based line from text content.
 */
function getLineAt(content: string, lineNumber: number): string {
  if (!content) {
    return '';
  }

  const lines = content.split(/\r?\n/);
  return lines[Math.max(0, lineNumber - 1)] ?? '';
}

/**
 * Extracts a nearby fragment around `startColumn`, clipping to a fixed width for readability.
 */
function getLineFragment(lineText: string, startColumn: number): string {
  if (!lineText) {
    return '(line unavailable)';
  }

  const maxWidth = 120;
  if (lineText.length <= maxWidth) {
    return lineText;
  }

  const centerIndex = Math.max(0, startColumn - 1);
  let start = Math.max(0, centerIndex - Math.floor(maxWidth / 2));
  const end = Math.min(lineText.length, start + maxWidth);

  if (end - start < maxWidth) {
    start = Math.max(0, end - maxWidth);
  }

  const prefix = start > 0 ? '…' : '';
  const suffix = end < lineText.length ? '…' : '';

  return `${prefix}${lineText.slice(start, end)}${suffix}`;
}

/**
 * Renders a warning into two lines for human output:
 * 1) gray source fragment
 * 2) yellow `[warning] line:column` prefix followed by plain message text
 */
export function renderWarningForHumanOutput(warning: string): string[] {
  const [fragmentRaw, locationAndMessageRaw] = warning.split('\n', 2);
  const fragment = fragmentRaw ?? '';
  const locationAndMessage = locationAndMessageRaw ?? '';

  const parsed = locationAndMessage.match(/^(\d+:\d+)\s+([\s\S]+)$/);
  const location = parsed?.[1] ?? '';
  const message = parsed?.[2] ?? locationAndMessage;

  const lines = [ux.colorize('gray', `${INDENT}${BULLET} ${fragment}`)];

  if (location) {
    lines.push(`${INDENT}${ux.colorize('yellow', '[warning]')} ${ux.colorize('yellow', location)} ${message}`);
  } else {
    lines.push(`${INDENT}${ux.colorize('yellow', '[warning]')} ${message}`);
  }

  return lines;
}

/**
 * Validates `service.yaml` against the cloud or self-hosted schema, depending on project type.
 */
export async function runConfigTest(projectDir: string, isCloud: boolean): Promise<ValidationTestRunResult> {
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
    return { errors: [message], passed: false };
  }
}

/**
 * Runs cloud sync-rules validation and maps diagnostics into warning/error message arrays.
 */
export async function runSyncConfigTestCloud(project: CloudProject): Promise<SyncValidationTestRunResult> {
  const syncRulesPath = join(project.projectDirectory, SYNC_FILENAME);
  const syncRulesContent =
    project.syncRulesContent ?? (existsSync(syncRulesPath) ? readFileSync(syncRulesPath, 'utf8') : undefined);
  const syncText = syncRulesContent ?? '';

  try {
    const result = await validateCloudSyncRules({
      linked: project.linked,
      syncRulesContent: syncText
    });

    const errors = result.diagnostics
      .filter((diagnostic) => diagnostic.level === 'fatal')
      .map((diagnostic) => formatSyncDiagnosticMessage(diagnostic, syncText));
    const warnings = result.diagnostics
      .filter((diagnostic) => diagnostic.level === 'warning')
      .map((diagnostic) => formatSyncDiagnosticMessage(diagnostic, syncText));

    return {
      // Add detailed diagnostics for errors and warnings.
      diagnostics: result.diagnostics,
      errors: errors.length > 0 ? errors : undefined,
      passed: errors.length === 0,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { diagnostics: [], errors: [message], passed: false };
  }
}

/**
 * Runs self-hosted sync-rules validation and maps diagnostics into warning/error message arrays.
 */
export async function runSyncConfigTestSelfHosted(project: SelfHostedProject): Promise<SyncValidationTestRunResult> {
  const syncRulesPath = join(project.projectDirectory, SYNC_FILENAME);
  const syncRulesContent = existsSync(syncRulesPath) ? readFileSync(syncRulesPath, 'utf8') : undefined;
  const syncText = syncRulesContent ?? '';
  try {
    const result = await validateSelfHostedSyncRules({
      linked: project.linked,
      syncRulesContent: syncText
    });

    const errors = result.diagnostics
      .filter((diagnostic) => diagnostic.level === 'fatal')
      .map((diagnostic) => formatSyncDiagnosticMessage(diagnostic, syncText));
    const warnings = result.diagnostics
      .filter((diagnostic) => diagnostic.level === 'warning')
      .map((diagnostic) => formatSyncDiagnosticMessage(diagnostic, syncText));

    return {
      diagnostics: result.diagnostics,
      errors: errors.length > 0 ? errors : undefined,
      passed: errors.length === 0,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { diagnostics: [], errors: [message], passed: false };
  }
}
