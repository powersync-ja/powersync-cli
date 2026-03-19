import { createSelfHostedClient, SelfHostedProject } from '@powersync/cli-core';

/**
 * Fetches the sync config content for a self-hosted project.
 * @param project - The project to fetch the sync config content for.
 * @returns The sync config content.
 */
export async function fetchSelfHostedSyncRulesContent(project: SelfHostedProject): Promise<string> {
  // First try and use the local file
  if (project.syncRulesContent) {
    return project.syncRulesContent;
  }

  const { linked } = project;
  const client = createSelfHostedClient({
    apiKey: linked.api_key,
    apiUrl: linked.api_url
  });

  // Try and fetch from the self-hosted config
  const instanceConfig = await client.diagnostics({});
  const content = instanceConfig.active_sync_rules?.content;

  if (!content) {
    throw new Error('No active sync config found');
  }

  return content;
}
