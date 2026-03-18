import { ux } from '@oclif/core';
import { SyncDiagnostic, ValidationResult, ValidationTestResult, ValidationTestRunResult } from '@powersync/cli-core';
import { Document } from 'yaml';

import { ValidationTest } from './ValidationTestDefinition.js';

/** Indentation used for nested human-readable output rows. */
const INDENT = '  ';

/** Bullet character used for list rows in human-readable output. */
const BULLET = '•';

/**
 * Stable output names used as the `name` field in JSON/YAML output.
 * These match the values from before the ValidationTest enum was refactored to kebab-case IDs,
 * preserving backward compatibility for scripts that pattern-match `--output=json|yaml` results.
 * Also used as display names in human-readable terminal output.
 */
export const STABLE_OUTPUT_NAMES: Record<ValidationTest, string> = {
  [ValidationTest.CONFIGURATION]: 'Validate Configuration Schema',
  [ValidationTest.CONNECTIONS]: 'Test Connections',
  [ValidationTest['SYNC-CONFIG']]: 'Validate Sync Config'
};

/**
 * Merges two or more `ValidationTestRunResult` objects into one.
 * The merged result passes only if all inputs passed.
 * Errors, warnings, and prettyOutput from all inputs are combined.
 */
export function mergeValidationTestRunResults(...results: ValidationTestRunResult[]): ValidationTestRunResult {
  const errors = results.flatMap((r) => r.errors ?? []);
  const warnings = results.flatMap((r) => r.warnings ?? []);
  const prettyParts = results.map((r) => r.prettyOutput).filter(Boolean);

  return {
    errors: errors.length > 0 ? errors : undefined,
    passed: results.every((r) => r.passed),
    prettyOutput: prettyParts.length > 0 ? prettyParts.join('\n') : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Formats spinner text showing per-test progress while tests are running.
 * These logs are indeted with bullets for readability, and update in-place as each test settles to show pass/fail status.
 */
export function formatOraMessage(
  tests: ValidationTest[],
  entries: Map<ValidationTest, ValidationTestRunResult>
): string {
  return tests
    .map((test) => {
      const result = entries.get(test);
      const prettyName = STABLE_OUTPUT_NAMES[test] ?? test;
      return result === undefined ? `\t... ${prettyName}` : result.passed ? `\t✓ ${prettyName}` : `\t✗ ${prettyName}`;
    })
    .join('\n');
}

/**
 * Formats a validation error for human-readable output.
 */
export function formatValidationErrorHuman(error: unknown): string {
  return ux.colorize('red', `${INDENT}${BULLET} ${error}`);
}

/**
 * Formats one test result into human-readable plain text.
 */
function formatTestResultHuman(test: ValidationTestResult): string {
  const status = test.passed ? '✓' : '✗';
  const name = `${status} ${STABLE_OUTPUT_NAMES[test.name as ValidationTest] ?? test.name}`;
  if (test.prettyOutput) {
    // Use custom pretty output if provided.
    return `${name}\n${test.prettyOutput}`;
  }

  const warningLines = (test.warnings ?? []).map(
    (warning) => `${INDENT}${BULLET} ${ux.colorize('yellow', '[warning]')} ${warning}`
  );
  if (test.passed && warningLines.length === 0) return name;
  const errorLines = (test.errors ?? []).map((e) => `${INDENT}${BULLET} ${ux.colorize('red', '[error]')} ${e}`);
  return [name, ...warningLines, ...errorLines].join('\n');
}

/**
 * Formats suite output for `--output=human`.
 */
export function formatValidationHuman(result: ValidationResult): string {
  const footer = result.passed
    ? ux.colorize('green', 'All validation tests passed.')
    : ux.colorize('red', 'Some validation tests failed.');
  const lines = [...result.tests.map((test) => formatTestResultHuman(test)), '', footer];
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
export function formatSyncDiagnosticMessage(diagnostic: SyncDiagnostic, syncRulesContent: string): string {
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
 * Renders a sync diagnostic into two lines for human output:
 * 1) gray source fragment
 * 2) colored `[error]` or `[warning]` label with `line:column` prefix followed by plain message text
 */
export function renderDiagnosticForHumanOutput(diagnostic: string, level: 'error' | 'warning'): string[] {
  const [fragmentRaw, locationAndMessageRaw] = diagnostic.split('\n', 2);
  const fragment = fragmentRaw ?? '';
  const locationAndMessage = locationAndMessageRaw ?? '';

  const parsed = locationAndMessage.match(/^(\d+:\d+)\s+([\s\S]+)$/);
  const location = parsed?.[1] ?? '';
  const message = parsed?.[2] ?? locationAndMessage;

  const color = level === 'error' ? 'red' : 'yellow';
  const label = level === 'error' ? '[error]' : '[warning]';

  const lines = [ux.colorize('gray', `${INDENT}${BULLET} ${fragment}`)];

  if (location) {
    lines.push(`${INDENT}${ux.colorize(color, label)} ${ux.colorize(color, location)} ${message}`);
  } else {
    lines.push(`${INDENT}${ux.colorize(color, label)} ${message}`);
  }

  return lines;
}
