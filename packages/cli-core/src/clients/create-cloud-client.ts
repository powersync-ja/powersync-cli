import * as sdk from '@journeyapps-labs/common-sdk';
import { ux } from '@oclif/core';
import { PowerSyncManagementClient } from '@powersync/management-client';

import { Services } from '../services/Services.js';
import { env } from '../utils/env.js';

/**
 * Process-wide store key for cloud client headers.
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
const CLOUD_CLIENT_HEADERS_STORE_KEY = Symbol.for('powersync.cli-core.cloudClientHeaders');

type CloudClientHeadersStore = {
  headers: Record<string, string>;
};

export function getCloudClientHeadersStore(): CloudClientHeadersStore {
  // Read/write the shared process-wide store so all cli-core instances observe the same headers.
  const globalScope = globalThis as typeof globalThis & {
    [CLOUD_CLIENT_HEADERS_STORE_KEY]?: CloudClientHeadersStore;
  };

  if (!globalScope[CLOUD_CLIENT_HEADERS_STORE_KEY]) {
    globalScope[CLOUD_CLIENT_HEADERS_STORE_KEY] = { headers: {} };
  }

  return globalScope[CLOUD_CLIENT_HEADERS_STORE_KEY];
}

/**
 * Sets headers that are applied to all cloud clients created by this module.
 * Existing clients also pick up updates because headers are resolved per request.
 */
export function setCloudClientHeaders(headers: Record<string, string>): void {
  Object.assign(getCloudClientHeadersStore().headers, headers);
}

/**
 * Creates a PowerSync Management Client for the Cloud.
 * Uses the token stored by the login command (secure storage, e.g. macOS Keychain).
 */
export function createCloudClient(): PowerSyncManagementClient {
  return new PowerSyncManagementClient({
    /**
     * Use the web network client rather than the node client. The node client
     * uses agentkeepalive to pool TCP connections across requests. When making
     * multiple requests from the same client, connection reuse can cause 400 Bad
     * Request errors if the server closes connections before the client's
     * freeSocketTimeout (30s). The web client uses fetch() which manages
     * connections differently and avoids this stale-connection issue.
     * Node.js exposes fetch as a global, so we can use it directly without importing it.
     */
    client: sdk.createWebNetworkClient({
      async headers() {
        const token = env.PS_ADMIN_TOKEN || (await Services.authentication.getToken());
        if (!token) {
          throw new Error(
            `Not logged in. Run ${ux.colorize('blue', 'powersync login')} to authenticate (you will be prompted for your token), or provide the ${ux.colorize('blue', 'PS_ADMIN_TOKEN')} environment variable.`
          );
        }

        return {
          ...getCloudClientHeadersStore().headers,
          Authorization: `Bearer ${token}`
        };
      }
    }),
    endpoint: env._PS_MANAGEMENT_SERVICE_URL
  });
}
