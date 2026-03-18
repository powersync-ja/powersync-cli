import { JourneyError } from '@journeyapps-labs/micro-errors';

const AUTH_HINT = 'Authentication failed. Your PAT TOKEN might be invalid — run `powersync login` to refresh.';

/** HTTP 401-style and explicit authorization failures from microservice clients. */
export function isPowersyncAuthServiceError(err: JourneyError): boolean {
  const { code, status } = err.errorData;
  return status === 401 || code === 'AUTHORIZATION' || err.name === 'AuthorizationError';
}

function displayNameFor(err: JourneyError): string {
  if (isPowersyncAuthServiceError(err)) {
    return 'PowerSyncAuthError';
  }

  const n = err.errorData.name ?? err.name;
  return n === 'JourneyError' ? 'PowerSyncError' : (n ?? 'PowerSyncError');
}

/**
 * Serializes microservice {@link JourneyError} for CLI output with PowerSync branding
 * and extra context for authentication failures.
 */
export function formatPowersyncServiceErrorDisplay(err: JourneyError): string {
  const base = { ...(err.toJSON() as Record<string, unknown>) };
  base.name = displayNameFor(err);
  if (isPowersyncAuthServiceError(err)) {
    base.category = 'authentication';
    base.hint = AUTH_HINT;
  }

  return JSON.stringify(base, null, '\t');
}
