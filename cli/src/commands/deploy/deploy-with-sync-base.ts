import { withCloudSyncConfigFilePath } from '@powersync/cli-core';

import DeployCommandBase from './deploy-command-base.js';

/** Deploy commands that read local sync YAML (full deploy, deploy sync-config). */
export const DeployCommandBaseWithSyncPath = withCloudSyncConfigFilePath(DeployCommandBase);
