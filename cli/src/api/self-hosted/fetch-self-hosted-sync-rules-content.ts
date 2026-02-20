import { createSelfHostedClient, SelfHostedProject, SYNC_FILENAME } from '@powersync/cli-core';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Fetches the sync config content for a self-hosted project.
 * @param project - The project to fetch the sync config content for.
 * @returns The sync config content.
 */
export async function fetchSelfHostedSyncRulesContent(project: SelfHostedProject): Promise<string> {
  const { linked } = project;
  const client = createSelfHostedClient({
    apiKey: linked.api_key,
    apiUrl: linked.api_url
  });

  // First try and use the local file
  if (existsSync(join(project.projectDirectory, SYNC_FILENAME))) {
    return readFileSync(join(project.projectDirectory, SYNC_FILENAME), 'utf8');
  }

  // Try and fetch from the cloud config
  const instanceConfig = await client.diagnostics({});
  const content = instanceConfig.active_sync_rules?.content;

  if (!content) {
    throw new Error('No active sync config found');
  }

  return content;
}
