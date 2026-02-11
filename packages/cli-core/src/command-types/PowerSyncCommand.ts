import { JourneyError } from '@journeyapps-labs/micro-errors';
import { Command, ux } from '@oclif/core';
import { join } from 'node:path';
export type StyledErrorParams = {
  error?: any;
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
   *
   * Like {@link Command.error}, this ends execution: it throws and the process exits, so code
   * after a call to styledError will not run.
   */
  styledError(params: StyledErrorParams): never {
    const { error, exitCode = 1, message, suggestions } = params;
    // Journey SDK errors contain additional fields that we want to pass to the error handler.
    const journeyError =
      error != null && typeof error === 'object' && 'is_journey_error' in error ? (error as JourneyError) : undefined;
    const journeyErrorMessage = journeyError ? JSON.stringify(journeyError.toJSON(), null, '\t') : undefined;

    const errorDetails =
      journeyErrorMessage ?? (error != null ? (error instanceof Error ? error.message : String(error)) : '');
    const displayMessage = errorDetails ? `${message}, :: ${errorDetails}` : message;

    this.error(ux.colorize('red', displayMessage), {
      ...(error instanceof Error ? error : {}),
      code: journeyError?.errorData?.code ?? 'UNKNOWN_ERROR',
      message: journeyErrorMessage ?? message,
      exit: exitCode,
      ...(suggestions?.length && { suggestions })
    });
  }
}
