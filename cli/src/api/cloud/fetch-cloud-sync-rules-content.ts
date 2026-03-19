import { CloudProject, createCloudClient } from '@powersync/cli-core';

/**
 * Fetches the sync config content for a cloud project.
 * @param project - The project to fetch the sync config content for.
 * @returns The sync config content.
 */
export async function fetchCloudSyncRulesContent(project: CloudProject): Promise<string> {
  // First try and use the local file
  if (project.syncRulesContent) {
    return project.syncRulesContent;
  }

  const { linked } = project;
  const client = createCloudClient();

  // Try and fetch from the cloud config
  const instanceConfig = await client.getInstanceConfig({
    app_id: linked.project_id,
    id: linked.instance_id,
    org_id: linked.org_id
  });

  if (!instanceConfig.sync_rules) {
    throw new Error('No sync config found');
  }

  return instanceConfig.sync_rules;
}
