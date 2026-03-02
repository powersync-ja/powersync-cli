import { Flags, ux } from '@oclif/core';
import fs from 'node:fs';

import { CLI_FILENAME } from '../utils/project-config.js';
import { HelpGroup } from './HelpGroup.js';
import { PowerSyncCommand } from './PowerSyncCommand.js';

export type EnsureConfigOptions = {
  configFileRequired?: boolean;
};

export const DEFAULT_ENSURE_CONFIG_OPTIONS: Required<EnsureConfigOptions> = {
  /**
   * Only the deploy and config related commands actually require the config to be present.
   */
  configFileRequired: false
};

export const DEFAULT_INSTANCE_DIRECTORY = 'powersync';

/** Base command for operations that target a PowerSync project directory (e.g. link, init). */
export abstract class InstanceCommand extends PowerSyncCommand {
  static flags = {
    ...PowerSyncCommand.flags,
    directory: Flags.string({
      async default() {
        // Before we default, we need to ensure only 1 linked project is present.
        const directories = fs.readdirSync(process.cwd()).filter((dir) => fs.existsSync(`${dir}/${CLI_FILENAME}`));
        if (directories.length > 1) {
          throw new Error(
            [
              `Multiple directories containing ${CLI_FILENAME} found. Please specify the target directory with --directory.`,
              ...directories.map(
                (dir) => `Use ${ux.colorize('blue', `--directory=${dir}`)} to target the ${dir} config.`
              )
            ].join('\n')
          );
        }

        return DEFAULT_INSTANCE_DIRECTORY;
      },
      description:
        'Directory containing PowerSync config. Defaults to "powersync". This is required if multiple powersync config files are present in subdirectories of the current working directory.',
      helpGroup: HelpGroup.PROJECT
    })
  };

  ensureProjectDirectory(flags: { directory: string }): string {
    const projectDir = this.resolveProjectDir(flags);
    if (!fs.existsSync(projectDir)) {
      this.styledError({
        message: `Directory "${flags.directory}" not found. Run ${ux.colorize('blue', 'powersync init cloud')} or ${ux.colorize('blue', 'powersync init self-hosted')} first to create the project.`
      });
    }

    return projectDir;
  }
}
