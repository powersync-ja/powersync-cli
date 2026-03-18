import { Interfaces } from '@oclif/core';
import { readFileSync } from 'node:fs';

import { syncConfigFilePathFlags } from '../utils/sync-config-file-path-flags.js';
import type { EnsureConfigOptions } from './InstanceCommand.js';
import { SharedInstanceCommand } from './SharedInstanceCommand.js';
import type { SharedInstanceCommandFlags } from './SharedInstanceCommand.js';
import type { CloudProject } from './CloudInstanceCommand.js';
import type { SelfHostedProject } from './SelfHostedInstanceCommand.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SharedCommandCtor = new (...args: any[]) => SharedInstanceCommand;

/**
 * Mixin: adds `--sync-config-file-path` for shared (cloud/self-hosted) commands that validate or otherwise need local sync YAML.
 * Commands that only need instance linking (e.g. status, token) should extend {@link SharedInstanceCommand} without this mixin.
 */
export function withSharedSyncConfigFilePath<T extends SharedCommandCtor>(Base: T) {
  return class SharedCommandWithSyncConfigFilePath extends Base {
    static flags = {
      ...Base.flags,
      ...syncConfigFilePathFlags
    };

    override async loadProject(
      flags: Interfaces.InferredFlags<typeof SharedCommandWithSyncConfigFilePath.flags>,
      options?: EnsureConfigOptions
    ): Promise<CloudProject | SelfHostedProject> {
      const project = await super.loadProject(flags as unknown as SharedInstanceCommandFlags, options);
      const customPath = flags['sync-config-file-path'];
      if (customPath) {
        project.syncRulesContent = readFileSync(customPath, 'utf8');
      }
      return project;
    }
  };
}

/** Base for commands that need optional local sync config path override (e.g. `powersync validate`). */
export const SharedInstanceCommandWithSyncConfigPath = withSharedSyncConfigFilePath(SharedInstanceCommand);
