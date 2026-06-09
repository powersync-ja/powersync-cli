import { ux } from '@oclif/core';
import { ValidationResult, ValidationTestResult, ValidationTestRunResult } from '@powersync/cli-core';
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
 * Errors and warnings from all inputs are combined so callers can compose validation phases.
 */
export function mergeValidationTestRunResults(...results: ValidationTestRunResult[]): ValidationTestRunResult {
  const errors = results.flatMap((r) => r.errors ?? []);
  const warnings = results.flatMap((r) => r.warnings ?? []);

  return {
    errors: errors.length > 0 ? errors : undefined,
    passed: results.every((r) => r.passed),
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Formats spinner text showing per-test progress while tests are running.
 * These logs are indented with bullets for readability, and update in-place as each test settles to show pass/fail status.
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

function formatTestResultHuman(test: ValidationTestResult): string {
  const status = test.passed ? '✓' : '✗';
  const name = `${status} ${STABLE_OUTPUT_NAMES[test.name as ValidationTest] ?? test.name}`;

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
