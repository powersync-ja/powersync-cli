import { Flags } from '@oclif/core';
import { existsSync } from 'node:fs';
import { HelpGroup } from './HelpGroup.js';
import { PowerSyncCommand } from './PowerSyncCommand.js';

export type EnsureConfigOptions = {
  /**
   * If the service.yaml file is required to be present in the project directory.
   */
  configFileRequired: boolean;

  /**
   * If true, when link.yaml is missing show a "Linking is required" message with example command.
   * If false or omitted, missing or invalid link.yaml results in a parse error.
   */
  linkingIsRequired?: boolean;
};

/** Base command for operations that target a PowerSync project directory (e.g. link, init). */
export abstract class InstanceCommand extends PowerSyncCommand {
  static flags = {
    ...PowerSyncCommand.flags,
    directory: Flags.string({
      default: 'powersync',
      description: 'Directory containing PowerSync config (default: powersync).',
      helpGroup: HelpGroup.PROJECT
    })
  };

  /**
   * Resolves the project directory and ensures it exists.
   * Calls this.error and exits if the directory is missing.
   * @returns The resolved absolute path to the project directory.
   */
  ensureProjectDirExists(flags: { directory: string }): string {
    const { directory } = flags;
    const projectDir = this.resolveProjectDir(flags);

    if (!existsSync(projectDir)) {
      this.error(`Directory "${directory}" not found. Run \`powersync init\` first to create the project.`, {
        exit: 1
      });
    }

    return projectDir;
  }
}
