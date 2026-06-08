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
 * Sync-config validation as reported by CLI commands. Detailed editor metadata stays on
 * {@link SyncValidationError}; command output only needs display strings.
 */
export type SyncValidationTestRunResult = ValidationTestRunResult;

/**
 * Aggregate result for the full validation test suite.
 */
export type ValidationResult = {
  passed: boolean;
  tests: ValidationTestResult[];
};

/**
 * Position in a sync config file.
 */
export type SyncConfigPosition = {
  column: number;
  line: number;
};

/**
 * Start and end location span for a sync config validation issue.
 */
export type SyncConfigLocation = {
  end: SyncConfigPosition;
  start: SyncConfigPosition;
};

/**
 * Raw response returned from the validation call made to a PowerSync instance.
 */
export type SyncErrorResponse = routes.ValidateSyncRulesResponse['errors'][number];

/**
 * Sync validation error or warning enriched with editor and display metadata.
 */
export type SyncValidationError = SyncErrorResponse & {
  /**
   * Original message plus source line and caret when a sync config location is available.
   * CLI output adds the line/column prefix separately so editor panels can render location once.
   */
  enrichedMessage: string;
  /**
   * Line and column range in the sync config file. This is distinct from the raw API `location`,
   * which uses character offsets.
   */
  syncConfigLocation?: SyncConfigLocation;
};

/**
 * Enhanced result of sync config validation.
 */
export type SyncValidation = Omit<routes.ValidateSyncRulesResponse, 'errors'> & {
  errors: SyncValidationError[];
};

const EMPTY_SYNC_CONFIG_ERROR: SyncValidation = {
  connections: [],
  errors: [
    {
      enrichedMessage: 'No sync config content was provided.',
      level: 'fatal',
      message: 'No sync config content was provided.'
    }
  ]
};

export async function validateCloudSyncRules(input: {
  linked: ResolvedCloudCLIConfig;
  syncConfigContent: string;
}): Promise<SyncValidation> {
  try {
    const client = createCloudClient();

    return enrichSyncValidationResult({
      result: await client.validateSyncRules({
        app_id: input.linked.project_id,
        id: input.linked.instance_id,
        org_id: input.linked.org_id,
        sync_rules: input.syncConfigContent
      }),
      syncConfigContent: input.syncConfigContent
    });
  } catch (error) {
    return wrapSyncValidationError({
      errorCause: error,
      message: `Could not validate sync config against the cloud instance. Deploy the instance first with "powersync deploy service-config" and try again.`
    });
  }
}

export async function validateSelfHostedSyncRules(input: {
  linked: ResolvedSelfHostedCLIConfig;
  syncConfigContent: string;
}): Promise<SyncValidation> {
  try {
    const client = createSelfHostedClient({
      apiKey: input.linked.api_key,
      apiUrl: input.linked.api_url
    });

    return enrichSyncValidationResult({
      result: await client.validate({ sync_rules: input.syncConfigContent }),
      syncConfigContent: input.syncConfigContent
    });
  } catch (error) {
    return wrapSyncValidationError({
      errorCause: error,
      message: `Could not validate sync config against the self-hosted instance. Ensure the instance is linked and running, then try again.`
    });
  }
}

export async function validateProjectSyncConfig(input: {
  linkedProject: CloudProject | SelfHostedProject;
  syncConfigContent: string;
}): Promise<SyncValidation> {
  // The loaded project keeps its historical `syncRulesContent` field name, but this API
  // otherwise uses sync-config naming for new validation plumbing.
  if (!input.linkedProject.syncRulesContent?.trim()) {
    return EMPTY_SYNC_CONFIG_ERROR;
  }

  if (input.linkedProject.linked.type === 'cloud') {
    return validateCloudSyncRules({
      linked: input.linkedProject.linked,
      syncConfigContent: input.syncConfigContent
    });
  }

  return validateSelfHostedSyncRules({
    linked: input.linkedProject.linked,
    syncConfigContent: input.syncConfigContent
  });
}

/**
 * Enriches a Sync config validation result by:
 * - adding `syncConfigLocation` with line and column information when available
 * - adding `enrichedMessage`, which includes source context for terminal and editor details display
 *
 * This keeps `message` raw for marker hover text while giving callers enough structured data
 * to decide how to render line/column details.
 */
function enrichSyncValidationResult({
  result,
  syncConfigContent
}: {
  result: routes.ValidateSyncRulesResponse;
  syncConfigContent: string;
}): SyncValidation {
  return {
    ...result,
    errors: result.errors.map((error) => {
      const syncConfigLocation = getSyncConfigLocation({ error, syncConfigContent });

      return {
        ...error,
        enrichedMessage: formatSyncValidationMessage({
          message: error.message,
          syncConfigContent,
          syncConfigLocation
        }),
        ...(syncConfigLocation ? { syncConfigLocation } : {})
      };
    })
  };
}

function getSyncConfigLocation({
  error,
  syncConfigContent
}: {
  error: SyncErrorResponse;
  syncConfigContent: string;
}): SyncConfigLocation | undefined {
  if (!error.location) {
    return undefined;
  }

  return {
    end: getLineAndColumnFromCharOffset({
      startCharOffset: error.location.end_offset,
      text: syncConfigContent
    }),
    start: getLineAndColumnFromCharOffset({
      startCharOffset: error.location.start_offset,
      text: syncConfigContent
    })
  };
}

/**
 * Wraps validation transport/setup failures into the same shape as API validation errors.
 */
function wrapSyncValidationError({ errorCause, message }: { errorCause: unknown; message: string }): SyncValidation {
  const cause = errorCause instanceof Error ? errorCause.message : String(errorCause);
  return {
    connections: [],
    errors: [
      {
        enrichedMessage: `${message}. Cause: ${cause}`,
        level: 'fatal',
        message: `${message}. Cause: ${cause}`
      }
    ]
  };
}

/**
 * Maps the API's raw character offsets to one-based line/column positions for editor markers.
 */
function getLineAndColumnFromCharOffset({
  startCharOffset,
  text
}: {
  startCharOffset: number;
  text: string;
}): SyncConfigPosition {
  const lines = text.split('\n');
  let charCount = 0;

  for (const [i, line_] of lines.entries()) {
    const line = line_ || '';
    const lineLengthWithNewline = line.length + 1;

    if (charCount + lineLengthWithNewline > startCharOffset) {
      return {
        column: startCharOffset - charCount + 1,
        line: i + 1
      };
    }

    charCount += lineLengthWithNewline;
  }

  const lastLine = lines.at(-1) || '';
  return {
    column: lastLine.length + 1,
    line: lines.length
  };
}

/**
 * Builds a multi-line validation message containing the original message, source fragment and caret.
 */
function formatSyncValidationMessage({
  message,
  syncConfigContent,
  syncConfigLocation
}: {
  message: string;
  syncConfigContent: string;
  syncConfigLocation?: SyncConfigLocation;
}): string {
  if (!syncConfigLocation) {
    return message;
  }

  const sourceLine = syncConfigContent.split('\n')[syncConfigLocation.start.line - 1];
  if (sourceLine == null) {
    return message;
  }

  const caretPrefix = `${' '.repeat(Math.max((syncConfigLocation.start.column ?? 1) - 1, 0))}^`;

  return `${message}\n${sourceLine}\n${caretPrefix}`;
}
