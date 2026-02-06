import * as sdk from '@journeyapps-labs/common-sdk';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { getSecureStorage } from '../services/SecureStorage.js';
import { env } from '../utils/env.js';

/**
 * Creates a PowerSync Management Client for the Cloud.
 * Uses the token stored by the login command (secure storage, e.g. macOS Keychain).
 */
export async function createCloudClient(): Promise<PowerSyncManagementClient> {
  const storage = getSecureStorage();
  const token = env.PS_TOKEN || (await storage.getToken());
  if (!token) {
    throw new Error(
      'Not logged in. Run `powersync login` to authenticate (you will be prompted for your token). Login is supported on macOS (other platforms coming soon).'
    );
  }
  return new PowerSyncManagementClient({
    client: sdk.createNodeNetworkClient({
      headers: () => ({
        Authorization: `Bearer ${token}`
      })
    }),
    endpoint: env._PS_MANAGEMENT_SERVICE_URL
  });
}
