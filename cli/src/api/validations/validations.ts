import {
  CloudProject,
  parseYamlFile,
  SelfHostedProject,
  SERVICE_FILENAME,
  SYNC_FILENAME,
  SyncValidation,
  SyncValidationTestRunResult,
  validateCloudSyncRules,
  validateSelfHostedSyncRules,
  ValidationTestRunResult
} from '@powersync/cli-core';
import {
  ServiceCloudConfig,
  ServiceCloudConfigDecoded,
  ServiceSelfHostedConfig,
  validateCloudConfig
} from '@powersync/cli-schemas';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatSyncDiagnosticMessage, renderDiagnosticForHumanOutput } from './validation-utils.js';

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
 * Wraps the sync validation with enhanced error and warning information.
 *  - Adds line numbers to locations of sync config errors.
 *  - Adds a pretty human-readable output string with color formatting for terminal display.
 */
function wrapsSyncValidation(params: { result: SyncValidation; syncText: string }): SyncValidationTestRunResult {
  const { result, syncText } = params;
  const errors = result.diagnostics
    .filter((diagnostic) => diagnostic.level === 'fatal')
    .map((diagnostic) => formatSyncDiagnosticMessage(diagnostic, syncText));
  const warnings = result.diagnostics
    .filter((diagnostic) => diagnostic.level === 'warning')
    .map((diagnostic) => formatSyncDiagnosticMessage(diagnostic, syncText));

  const prettyOutput = [
    ...errors.map((line) => renderDiagnosticForHumanOutput(line, 'error').join('\n')),
    ...warnings.map((line) => renderDiagnosticForHumanOutput(line, 'warning').join('\n'))
  ].join('\n');

  return {
    diagnostics: result.diagnostics,
    errors: errors.length > 0 ? errors : undefined,
    passed: errors.length === 0,
    prettyOutput,
    warnings: warnings.length > 0 ? warnings : undefined
  };
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
    return wrapsSyncValidation({
      result: await validateCloudSyncRules({
        linked: project.linked,
        syncRulesContent: syncText
      }),
      syncText
    });
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
  const syncRulesContent =
    project.syncRulesContent ?? (existsSync(syncRulesPath) ? readFileSync(syncRulesPath, 'utf8') : undefined);
  const syncText = syncRulesContent ?? '';
  try {
    return wrapsSyncValidation({
      result: await validateSelfHostedSyncRules({
        linked: project.linked,
        syncRulesContent: syncText
      }),
      syncText
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { diagnostics: [], errors: [message], passed: false };
  }
}

export function parseCloudConfig(projectDirectory: string): ServiceCloudConfigDecoded {
  const servicePath = join(projectDirectory, SERVICE_FILENAME);
  const doc = parseYamlFile(servicePath);

  // validate the config with full schema
  const validationResult = validateCloudConfig(doc.contents?.toJSON());
  if (!validationResult.valid) {
    throw new Error(`Invalid cloud config: ${validationResult.errors?.join('\n')}`);
  }

  return ServiceCloudConfig.decode(doc.contents?.toJSON());
}
