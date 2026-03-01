import { validateProjectSyncRules } from '@powersync/cli-core';

import { env } from '../../env';

export async function validateSyncRulesWithCli(syncRulesContent: string) {
  const syncTest = await validateProjectSyncRules({
    linkedProject: env.POWERSYNC_PROJECT_CONTEXT!.linkedProject,
    syncRulesContent
  });

  return {
    issues: syncTest.diagnostics,
    passed: syncTest.errors.length === 0
  };
}
