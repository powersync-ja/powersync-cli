import { ResolvedCloudCLIConfig, ServiceCloudConfig, ServiceCloudConfigDecoded } from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { routes } from '@powersync/management-types';

export type FetchedCloudConfig = {
  config: ServiceCloudConfigDecoded;
  syncRules?: string;
};

export function decodeFetchedCloudConfig(instanceConfig: routes.InstanceConfigResponse): FetchedCloudConfig {
  const configFromCloud = { _type: 'cloud', name: instanceConfig.name, ...instanceConfig.config };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config = ServiceCloudConfig.decode(configFromCloud as any);
  return { config, syncRules: instanceConfig.sync_rules };
}

/**
 * Fetches instance config from PowerSync Cloud and decodes it.
 */
export async function fetchCloudConfig(
  client: PowerSyncManagementClient,
  linked: ResolvedCloudCLIConfig
): Promise<FetchedCloudConfig> {
  const instanceConfig = await client.getInstanceConfig({
    app_id: linked.project_id,
    id: linked.instance_id,
    org_id: linked.org_id
  });
  return decodeFetchedCloudConfig(instanceConfig);
}
