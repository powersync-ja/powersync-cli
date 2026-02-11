import { CloudProject, createCloudClient, SYNC_FILENAME } from '@powersync/cli-core';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Fetches the sync rules content for a cloud project.
 * @param project - The project to fetch the sync rules content for.
 * @returns The sync rules content.
 */
export async function fetchCloudSyncRulesContent(project: CloudProject): Promise<string> {
  const { linked } = project;
  const client = await createCloudClient();

  // First try and use the local file
  if (existsSync(join(project.projectDirectory, SYNC_FILENAME))) {
    return readFileSync(join(project.projectDirectory, SYNC_FILENAME), 'utf8');
  }

  // Try and fetch from the cloud config
  const instanceConfig = await client.getInstanceConfig({
    app_id: linked.project_id,
    org_id: linked.org_id,
    id: linked.instance_id
  });

  if (!instanceConfig.sync_rules) {
    throw new Error('No sync rules found');
  }

  return instanceConfig.sync_rules;
}
