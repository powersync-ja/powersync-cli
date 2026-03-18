import { Flags } from '@oclif/core';

import { HelpGroup } from '../command-types/HelpGroup.js';

/**
 * Shared CLI flags for overriding the sync config file path (used by CloudInstanceCommand and SharedInstanceCommand).
 */
export const syncConfigFilePathFlags = {
  'sync-config-file-path': Flags.file({
    description:
      '[Optional] Override the path to a sync config file. When set, this file is used instead of sync-config.yaml in the project directory.',
    exists: true,
    helpGroup: HelpGroup.PROJECT
  })
};
