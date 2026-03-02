import { validateProjectSyncConfig } from '@powersync/cli-core';

import { env } from '../../env';

/**
 * Validates the PowerSync sync config server side.
 */
export async function validateSyncRulesWithCli(syncRulesContent: string) {
  const syncTest = await validateProjectSyncConfig({
    linkedProject: env.POWERSYNC_PROJECT_CONTEXT!.linkedProject,
    syncRulesContent
  });

  return {
    issues: syncTest.diagnostics,
    passed: syncTest.errors.length === 0
  };
}
