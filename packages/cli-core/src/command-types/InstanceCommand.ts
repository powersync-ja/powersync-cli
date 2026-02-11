import { Flags } from '@oclif/core';
import { existsSync } from 'node:fs';
import { HelpGroup } from './HelpGroup.js';
import { PowerSyncCommand } from './PowerSyncCommand.js';

export type EnsureConfigOptions = {
  configFileRequired: boolean;
  linkingIsRequired?: boolean;
};

/** Base command for operations that target a PowerSync project directory (e.g. link, init). */
export abstract class InstanceCommand extends PowerSyncCommand {
  static flags = {
    ...PowerSyncCommand.flags,
    directory: Flags.string({
      default: 'powersync',
      description: 'Directory containing PowerSync config.',
      helpGroup: HelpGroup.PROJECT
    })
  };

  ensureProjectDirExists(flags: { directory: string }): string {
    const { directory } = flags;
    const projectDir = this.resolveProjectDir(flags);
    if (!existsSync(projectDir)) {
      this.styledError({
        message: `Directory "${directory}" not found. Run \`powersync init\` first to create the project.`
      });
    }
    return projectDir;
  }
}
