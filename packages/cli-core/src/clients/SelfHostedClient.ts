import * as sdk from '@journeyapps-labs/common-sdk';
import { InstanceClient } from '@powersync/service-client';

export type SelfHostedClientConfig = {
  apiUrl: string;
  apiKey: string;
};

/**
 * Creates a PowerSync Instance Client for a self-hosted instance.
 */
export function createSelfHostedClient(config: SelfHostedClientConfig) {
  return new InstanceClient({
    endpoint: config.apiUrl,
    client: sdk.createNodeNetworkClient({
      headers: () => ({
        Authorization: `Bearer ${config.apiKey}`
      })
    })
  });
}
