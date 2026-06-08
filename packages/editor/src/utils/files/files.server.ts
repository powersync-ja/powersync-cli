import type { SyncValidation } from '@powersync/cli-core';

import { validateProjectSyncConfig } from '@powersync/cli-core';

import { env } from '../../env';

/**
 * Validates the PowerSync sync config server side.
 */
export async function validateSyncConfigWithCli(syncConfigContent: string): Promise<SyncValidation> {
  if (!env.POWERSYNC_PROJECT_CONTEXT) {
    throw new Error('POWERSYNC_PROJECT_CONTEXT is not set. Open the editor via the CLI.');
  }

  return validateProjectSyncConfig({
    linkedProject: env.POWERSYNC_PROJECT_CONTEXT.linkedProject,
    syncConfigContent
  });
}
