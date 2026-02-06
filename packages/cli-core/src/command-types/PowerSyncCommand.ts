import { Command } from '@oclif/core';
import { join } from 'node:path';

/** Base command for operations that target a PowerSync project directory (e.g. link, init). */
export abstract class PowerSyncCommand extends Command {
  /** Resolves the project directory path from the --directory flag (relative to cwd). */
  resolveProjectDir(flags: { directory: string }): string {
    return join(process.cwd(), flags.directory);
  }
}
