import { validateProjectSyncConfig } from '@powersync/cli-core';

import { env } from '../../env';

/**
 * Validates the PowerSync sync config server side.
 */
export async function validateSyncRulesWithCli(syncRulesContent: string) {
  if (!env.POWERSYNC_PROJECT_CONTEXT) {
    throw new Error('POWERSYNC_PROJECT_CONTEXT is not set. Open the editor via the CLI.');
  }

  const syncTest = await validateProjectSyncConfig({
    linkedProject: env.POWERSYNC_PROJECT_CONTEXT.linkedProject,
    syncRulesContent
  });

  return {
    issues: syncTest.diagnostics,
    passed: syncTest.diagnostics.filter((d) => d.level === 'fatal').length === 0
  };
}
