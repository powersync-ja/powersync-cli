import { Command } from '@oclif/core';
import { readFileSync } from 'node:fs';

import type { CloudProject } from './CloudInstanceCommand.js';
import type { SelfHostedProject } from './SelfHostedInstanceCommand.js';
import type { SharedInstanceCommandFlags } from './SharedInstanceCommand.js';

import { syncConfigFilePathFlags } from '../utils/sync-config-file-path-flags.js';
import { SharedInstanceCommand } from './SharedInstanceCommand.js';

type ProjectLoadableCommand = Command & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _loadProjectHook(flags: any, project: CloudProject | SelfHostedProject): Promise<CloudProject | SelfHostedProject>;
};

/** Flags added by this mixin; use with base flags for loadProject. */
type SyncConfigFilePathFlags = { 'sync-config-file-path'?: string };

type ProjectLoadableCommandCtor = OclifCommandCtorWithFlags<ProjectLoadableCommand>;

/**
 * Oclif command constructor that exposes static `flags` (same shape as {@link Command.flags}).
 * Use this when a mixin spreads `Base.flags` so the base is known to declare flags.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OclifCommandCtorWithFlags<TInstance extends object = Command> = (abstract new (...args: any[]) => TInstance) &
  Pick<typeof Command, 'baseFlags'>;

/**
 * Adds `--sync-config-file-path` for shared (cloud/self-hosted) commands that need local sync YAML (e.g. validate).
 * Commands that only need instance linking (e.g. status, token) should extend {@link SharedInstanceCommand} without this mixin.
 */
export function WithSyncConfigFilePath<T extends ProjectLoadableCommandCtor>(Base: T): T {
  abstract class CommandWithSyncConfigFilePath extends Base {
    static baseFlags = {
      ...Base.baseFlags,
      ...syncConfigFilePathFlags
    };

    override async _loadProjectHook(
      flags: SharedInstanceCommandFlags & SyncConfigFilePathFlags,
      project: CloudProject | SelfHostedProject
    ): Promise<CloudProject | SelfHostedProject> {
      const customPath = flags['sync-config-file-path'];
      if (customPath) {
        project.syncRulesContent = readFileSync(customPath, 'utf8');
      }

      return project;
    }
  }

  return CommandWithSyncConfigFilePath;
}
