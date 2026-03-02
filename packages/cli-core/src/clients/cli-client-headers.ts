/**
 * Process-wide store key for CLI client headers.
 *
 * Why global:
 * - CLI startup code lives in the `cli` package, while client creation lives in `cli-core`.
 * - In some environments, duplicate copies of `@powersync/cli-core` could be loaded (in the future perhaps).
 * - Module-level state would then be duplicated, causing header injection (for example User-Agent)
 *   to only affect one copy.
 *
 * Using `globalThis` + `Symbol.for(...)` gives us one shared store for this process,
 * regardless of how many module instances are loaded.
 */
const CLI_CLIENT_HEADERS_STORE_KEY = Symbol.for('powersync.cli-core.cliClientHeaders');

type CliClientHeadersStore = {
  headers: Record<string, string>;
};

export function getCliClientHeadersStore(): CliClientHeadersStore {
  // Read/write the shared process-wide store so all cli-core instances observe the same headers.
  const globalScope = globalThis as typeof globalThis & {
    [CLI_CLIENT_HEADERS_STORE_KEY]?: CliClientHeadersStore;
  };

  if (!globalScope[CLI_CLIENT_HEADERS_STORE_KEY]) {
    globalScope[CLI_CLIENT_HEADERS_STORE_KEY] = { headers: {} };
  }

  return globalScope[CLI_CLIENT_HEADERS_STORE_KEY];
}

/**
 * Sets headers that are applied to all outbound CLI clients (cloud and self-hosted).
 * Existing clients also pick up updates because headers are resolved per request.
 */
export function setCliClientHeaders(headers: Record<string, string>): void {
  Object.assign(getCliClientHeadersStore().headers, headers);
}
