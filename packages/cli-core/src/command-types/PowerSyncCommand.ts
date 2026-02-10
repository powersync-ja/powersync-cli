import { Command, ux } from '@oclif/core';
import { join } from 'node:path';

export type StyledErrorParams = {
  error: any;
  message: string;
  suggestions?: string[];
  exitCode?: number;
};

/** Base command for operations that target a PowerSync project directory (e.g. link, init). */
export abstract class PowerSyncCommand extends Command {
  /** Resolves the project directory path from the --directory flag (relative to cwd). */
  resolveProjectDir(flags: { directory: string }): string {
    return join(process.cwd(), flags.directory);
  }

  /**
   * Reports a styled error via this.error. Normalizes a catch-block error (any) to an Error
   * and includes the cause in the displayed message.
   */
  protected styledError(params: StyledErrorParams): void {
    const { error, exitCode = 1, message, suggestions } = params;
    const err = error instanceof Error ? error : new Error(String(error));
    this.error(ux.colorize('red', `${message}`), {
      ...err,
      exit: exitCode,
      ...(suggestions?.length && { suggestions })
    });
  }
}
