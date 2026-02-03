import { Command, Flags } from '@oclif/core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Base command for operations that target a PowerSync project directory (e.g. link, init). */
export abstract class InstanceCommand extends Command {
  static flags = {
    directory: Flags.string({
      default: 'powersync',
      description: 'Directory containing PowerSync config (default: powersync).'
    })
  };

  /**
   * Resolves the project directory and ensures it exists.
   * Calls this.error and exits if the directory is missing.
   * @returns The resolved absolute path to the project directory.
   */
  ensureProjectDirExists(directory: string): string {
    const projectDir = this.resolveProjectDir(directory);

    if (!existsSync(projectDir)) {
      this.error(`Directory "${directory}" not found. Run \`powersync init\` first to create the project.`, {
        exit: 1
      });
    }

    return projectDir;
  }

  /** Resolves the project directory path from the --directory flag (relative to cwd). */
  resolveProjectDir(directory: string): string {
    return join(process.cwd(), directory);
  }
}
