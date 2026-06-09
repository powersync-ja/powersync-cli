import {
  CloudProject,
  parseYamlFile,
  SelfHostedProject,
  SERVICE_FILENAME,
  SYNC_FILENAME,
  SyncValidation,
  SyncValidationError,
  SyncValidationTestRunResult,
  validateProjectSyncConfig,
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
 * Formats sync validation messages for CLI output.
 * Core keeps `enrichedMessage` free of location prefixes so the editor can render location separately.
 */
function formatSyncValidationErrorForCli(error: SyncValidationError): string {
  if (!error.syncConfigLocation) {
    return error.enrichedMessage;
  }

  const { column, line } = error.syncConfigLocation.start;
  return `[Line ${line}, Column ${column}]: ${error.enrichedMessage}`;
}

/**
 * Wraps the sync validation with warning and error information for terminal display.
 */
function wrapsSyncValidation(result: SyncValidation): SyncValidationTestRunResult {
  const errors = result.errors
    .filter((issue) => issue.level === 'fatal')
    .map((issue) => formatSyncValidationErrorForCli(issue));
  const warnings = result.errors
    .filter((issue) => issue.level === 'warning')
    .map((issue) => formatSyncValidationErrorForCli(issue));

  return {
    // Keep JSON/YAML output backward-compatible: these fields are optional and
    // were historically omitted rather than emitted as empty arrays.
    errors: errors.length > 0 ? errors : undefined,
    passed: errors.length === 0,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Runs sync-config validation and maps warnings/errors into message arrays.
 */
export async function runSyncConfigTest(
  project: CloudProject | SelfHostedProject
): Promise<SyncValidationTestRunResult> {
  const syncConfigPath = join(project.projectDirectory, SYNC_FILENAME);
  const syncConfigContent =
    project.syncRulesContent ?? (existsSync(syncConfigPath) ? readFileSync(syncConfigPath, 'utf8') : undefined);

  try {
    return wrapsSyncValidation(
      await validateProjectSyncConfig({
        linkedProject: project,
        syncConfigContent: syncConfigContent ?? ''
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { errors: [message], passed: false };
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
