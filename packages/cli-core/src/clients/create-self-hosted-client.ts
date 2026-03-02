import * as sdk from '@journeyapps-labs/common-sdk';
import { InstanceClient } from '@powersync/service-client';

import { getCliClientHeadersStore } from './cli-client-headers.js';

export type SelfHostedClientConfig = {
  apiKey: string;
  apiUrl: string;
};

/**
 * Creates a PowerSync Instance Client for a self-hosted instance.
 */
export function createSelfHostedClient(config: SelfHostedClientConfig) {
  return new InstanceClient({
    /**
     * Use the web (fetch-based) network client to mirror the cloud client behavior and
     * allow fetch to be spied on in tests. Node exposes fetch globally so we can rely on it.
     */
    client: sdk.createWebNetworkClient({
      headers: () => ({
        ...getCliClientHeadersStore().headers,
        Authorization: `Bearer ${config.apiKey}`
      })
    }),
    endpoint: config.apiUrl
  });
}
