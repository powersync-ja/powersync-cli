import { JourneyError } from '@journeyapps-labs/micro-errors';
import { Command, ux } from '@oclif/core';
import { join } from 'node:path';

import { CommandHelpGroup } from './HelpGroup.js';

export type StyledErrorParams = {
  error?: Error | unknown;
  exitCode?: number;
  message: string;
  suggestions?: string[];
};

/** Base command for operations that target a PowerSync project directory (e.g. link, init). */
export abstract class PowerSyncCommand extends Command {
  /**
   * Controls which section this command appears under in the root help output.
   * Override in subclasses or individual commands to place them in the correct section.
   * Defaults to undefined, which maps to ADDITIONAL_COMMANDS in the help renderer.
   */
  static commandHelpGroup?: CommandHelpGroup;

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
      journeyErrorMessage ?? (error == null ? '' : error instanceof Error ? error.message : String(error));
    const displayMessage = errorDetails ? `${message}, :: ${errorDetails}` : message;

    this.error(ux.colorize('red', displayMessage), {
      ...(error instanceof Error ? error : {}),
      ...(journeyError?.errorData?.code && { code: journeyError.errorData.code }),
      exit: exitCode,
      message: journeyErrorMessage ?? message,
      ...(suggestions?.length && { suggestions })
    });
  }
}
