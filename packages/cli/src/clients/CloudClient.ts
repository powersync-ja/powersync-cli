import * as sdk from '@journeyapps-labs/common-sdk';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { env } from '../utils/env.js';

/**
 * Creates a PowerSync Management Client for the Cloud.
 * Uses the credentials from the login command.
 */
export function createCloudClient(): PowerSyncManagementClient {
  const getToken = () => {
    // TODO: get from secure store
    return 'TODO';
  };

  return new PowerSyncManagementClient({
    client: sdk.createNodeNetworkClient({
      headers: () => ({
        Authorization: `Bearer ${getToken()}`
      })
    }),
    endpoint: env._PS_MANAGEMENT_SERVICE_URL
  });
}
