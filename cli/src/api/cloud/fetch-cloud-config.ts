import { CLICloudConfig, CLICloudConfigDecoded, ResolvedCloudLinkConfig } from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';

export type FetchedCloudConfig = {
  config: CLICloudConfigDecoded;
  syncRules?: string;
};

/**
 * Fetches instance config from PowerSync Cloud and decodes it.
 */
export async function fetchCloudConfig(
  client: PowerSyncManagementClient,
  linked: ResolvedCloudLinkConfig
): Promise<FetchedCloudConfig> {
  const instanceConfig = await client.getInstanceConfig({
    app_id: linked.project_id,
    org_id: linked.org_id,
    id: linked.instance_id
  });
  const configFromCloud = { _type: 'cloud', name: instanceConfig.name, ...(instanceConfig.config ?? {}) };
  const config = CLICloudConfig.decode(configFromCloud as any);
  return { config, syncRules: instanceConfig.sync_rules };
}
