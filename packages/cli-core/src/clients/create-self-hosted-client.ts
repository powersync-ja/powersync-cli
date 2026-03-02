import * as sdk from '@journeyapps-labs/common-sdk';
import { InstanceClient } from '@powersync/service-client';

import { getCloudClientHeadersStore } from '../index.js';

export type SelfHostedClientConfig = {
  apiKey: string;
  apiUrl: string;
};

/**
 * Creates a PowerSync Instance Client for a self-hosted instance.
 */
export function createSelfHostedClient(config: SelfHostedClientConfig) {
  return new InstanceClient({
    client: sdk.createNodeNetworkClient({
      headers: () => ({
        ...getCloudClientHeadersStore().headers,
        Authorization: `Bearer ${config.apiKey}`
      })
    }),
    endpoint: config.apiUrl
  });
}
