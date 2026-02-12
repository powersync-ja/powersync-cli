import * as sdk from '@journeyapps-labs/common-sdk';
import { ux } from '@oclif/core';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { Services } from '../services/services.js';
import { env } from '../utils/env.js';

/**
 * Creates a PowerSync Management Client for the Cloud.
 * Uses the token stored by the login command (secure storage, e.g. macOS Keychain).
 */
export async function createCloudClient(): Promise<PowerSyncManagementClient> {
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
      headers: async () => {
        const token = env.TOKEN || (await Services.authentication.getToken());
        if (!token) {
          throw new Error(
            `Not logged in. Run ${ux.colorize('blue', 'powersync login')} to authenticate (you will be prompted for your token). Login is supported on macOS (other platforms coming soon), or provide the ${ux.colorize('blue', 'TOKEN')} environment variable.`
          );
        }
        return {
          Authorization: `Bearer ${token}`
        };
      }
    }),
    endpoint: env._PS_MANAGEMENT_SERVICE_URL
  });
}
