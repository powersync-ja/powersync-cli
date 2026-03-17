import type { routes } from '@powersync/management-types';

import { ResolvedCloudCLIConfig, ResolvedSelfHostedCLIConfig } from '@powersync/cli-schemas';

import type { CloudProject } from '../command-types/CloudInstanceCommand.js';
import type { SelfHostedProject } from '../command-types/SelfHostedInstanceCommand.js';

import { createCloudClient } from '../clients/create-cloud-client.js';
import { createSelfHostedClient } from '../clients/create-self-hosted-client.js';

/**
 * Result from one validation test execution.
 *
 * `passed` indicates overall pass/fail for the test.
 * `warnings` and `errors` hold preformatted human-readable messages.
 */
export type ValidationTestRunResult = {
  errors?: string[];
  passed: boolean;
  /**
   * Output containing errors and warnings in a pretty human-readable format.
   */
  prettyOutput?: string;
  warnings?: string[];
};

/**
 * Named validation test result for final reporting output.
 */
export type ValidationTestResult = ValidationTestRunResult & {
  /**
   * Machine-readable kebab-case identifier that matches the values accepted by
   * `--skip-validations` and `--validate-only` flags (e.g. `"sync-config"`).
   */
  id: string;
  /**
   * Human-readable display name. Preserved as a stable value for backward compatibility with
   * scripts that pattern-match the JSON/YAML output of `powersync validate --output=json|yaml`.
   */
  name: string;
};

/**
 * Sync-config-specific validation result that includes structured diagnostics.
 */
export type SyncValidationTestRunResult = ValidationTestRunResult & {
  diagnostics: SyncDiagnostic[];
};

/**
 * Aggregate result for the full validation test suite.
 */
export type ValidationResult = {
  passed: boolean;
  tests: ValidationTestResult[];
};

/**
 * Diagnostics warnings linked to the position in the sync rules file (line and column) where the issue occurs.
 */
export type SyncDiagnostic = {
  endColumn: number;
  endLine: number;
  level: 'fatal' | 'warning';
  message: string;
  startColumn: number;
  startLine: number;
};

/**
 * Enhanced result of sync config validation.
 */
export type SyncValidation = routes.ValidateSyncRulesResponse & {
  diagnostics: SyncDiagnostic[];
};

const EMPTY_SYNC_RULES_ERROR: routes.ValidateSyncRulesResponse = {
  connections: [],
  errors: [
    {
      level: 'fatal',
      message: 'No sync config content was provided.'
    }
  ]
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toValidationRequestError(type: 'cloud' | 'self-hosted', cause: unknown): Error {
  const causeMessage = getErrorMessage(cause);

  if (type === 'cloud') {
    return new Error(
      `Could not validate sync rules against the cloud instance. Deploy the instance first with "powersync deploy service-config" and try again.\n${causeMessage}`
    );
  }

  return new Error(
    `Could not validate sync rules against the self-hosted instance. Ensure the instance is linked and running, then try again.\n${causeMessage}`
  );
}

function offsetToLineColumn(text: string, offset?: number): { column: number; line: number } {
  const safeOffset = typeof offset === 'number' ? Math.max(0, Math.min(offset, text.length)) : 0;
  let line = 1;
  let column = 1;

  for (let i = 0; i < safeOffset; i++) {
    if (text.codePointAt(i) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { column, line };
}

function mapSyncDiagnostics(response: routes.ValidateSyncRulesResponse, syncRulesContent: string): SyncDiagnostic[] {
  const topLevel = response.errors.map((error) => {
    const start = offsetToLineColumn(syncRulesContent, error.location?.start_offset);
    const end = offsetToLineColumn(syncRulesContent, error.location?.end_offset ?? error.location?.start_offset);
    return {
      endColumn: end.column,
      endLine: end.line,
      level: error.level,
      message: error.message,
      startColumn: start.column,
      startLine: start.line
    };
  });

  return topLevel;
}

function toSyncValidation(response: routes.ValidateSyncRulesResponse, syncRulesContent: string): SyncValidation {
  return {
    ...response,
    diagnostics: mapSyncDiagnostics(response, syncRulesContent)
  };
}

export async function validateCloudSyncRules(input: {
  linked: ResolvedCloudCLIConfig;
  syncRulesContent: string;
}): Promise<SyncValidation> {
  if (!input.syncRulesContent.trim()) {
    return toSyncValidation(EMPTY_SYNC_RULES_ERROR, input.syncRulesContent);
  }

  try {
    const client = createCloudClient();
    const response = await client.validateSyncRules({
      app_id: input.linked.project_id,
      id: input.linked.instance_id,
      org_id: input.linked.org_id,
      sync_rules: input.syncRulesContent
    });

    return toSyncValidation(response, input.syncRulesContent);
  } catch (error) {
    throw toValidationRequestError('cloud', error);
  }
}

export async function validateSelfHostedSyncRules(input: {
  linked: ResolvedSelfHostedCLIConfig;
  syncRulesContent: string;
}): Promise<SyncValidation> {
  if (!input.syncRulesContent.trim()) {
    return toSyncValidation(EMPTY_SYNC_RULES_ERROR, input.syncRulesContent);
  }

  try {
    const client = createSelfHostedClient({
      apiKey: input.linked.api_key,
      apiUrl: input.linked.api_url
    });

    const response = await client.validate({ sync_rules: input.syncRulesContent });

    return toSyncValidation(response, input.syncRulesContent);
  } catch (error) {
    throw toValidationRequestError('self-hosted', error);
  }
}

export async function validateProjectSyncConfig(input: {
  linkedProject: CloudProject | SelfHostedProject;
  syncRulesContent: string;
}): Promise<SyncValidation> {
  if (input.linkedProject.linked.type === 'cloud') {
    return validateCloudSyncRules({
      linked: input.linkedProject.linked,
      syncRulesContent: input.syncRulesContent
    });
  }

  return validateSelfHostedSyncRules({
    linked: input.linkedProject.linked,
    syncRulesContent: input.syncRulesContent
  });
}
