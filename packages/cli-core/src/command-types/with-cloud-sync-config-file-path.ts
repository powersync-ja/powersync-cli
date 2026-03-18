import { Interfaces } from '@oclif/core';
import { readFileSync } from 'node:fs';

import { syncConfigFilePathFlags } from '../utils/sync-config-file-path-flags.js';
import type { CloudInstanceCommand } from './CloudInstanceCommand.js';
import type { CloudInstanceCommandFlags, CloudProject } from './CloudInstanceCommand.js';
import type { EnsureConfigOptions } from './InstanceCommand.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CloudCommandCtor = new (...args: any[]) => CloudInstanceCommand;

/**
 * Mixin: adds `--sync-config-file-path` and applies it in `loadProject` after the base cloud project load.
 * Use for commands that read local sync rules (e.g. full deploy, deploy sync-config). Omit for commands that only touch service config.
 */
export function withCloudSyncConfigFilePath<T extends CloudCommandCtor>(Base: T) {
  return class CloudCommandWithSyncConfigFilePath extends Base {
    static flags = {
      ...Base.flags,
      ...syncConfigFilePathFlags
    };

    override async loadProject(
      flags: Interfaces.InferredFlags<typeof CloudCommandWithSyncConfigFilePath.flags>,
      options?: EnsureConfigOptions
    ): Promise<CloudProject> {
      const project = await super.loadProject(flags as unknown as CloudInstanceCommandFlags, options);
      const customPath = flags['sync-config-file-path'];
      if (customPath) {
        project.syncRulesContent = readFileSync(customPath, 'utf8');
      }
      return project;
    }
  };
}
