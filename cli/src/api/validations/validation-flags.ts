import { Flags } from '@oclif/core';
import { Flag } from '@oclif/core/interfaces';

import { ValidationTest } from './ValidationTestDefinition.js';

export type GenerateValidationTestFlagsParams = {
  /**
   * Contrains the set of validation tests allowed to a smaller subset of {@link ValidationTest}
   */
  limitOptions?: ValidationTest[];
};

export type ParseValidationsFlagsResult = {
  skipped: ValidationTest[];
  testsToRun: ValidationTest[];
};

/**
 * Helpers for validation test flags for all options of {@link ValidationTest}.
 */
export const GENERAL_VALIDATION_FLAG_HELPERS = generateValidationTestFlags();

/**
 * Generates flag definitions and parsing logic for validation test selection flags, based on the provided options or all {@link ValidationTest} options by default.
 * Ensures that the flags are mutually exclusive and validates the input against the allowed options.
 * Allows specifying a limit set of {@ValidationTest} options to generate flags for, which is useful for commands that only support a subset of validation tests.
 */
export function generateValidationTestFlags(params?: GenerateValidationTestFlagsParams) {
  const { limitOptions } = params ?? {};
  const optionsToUse = limitOptions ?? Object.values(ValidationTest);

  const parseValidationFlagValues = (input: string, flagName: string) => {
    const split = input.split(',').map((s) => s.trim());
    const invalid = split.filter((s) => !optionsToUse.includes(s as ValidationTest));
    if (invalid.length > 0) {
      throw new Error(
        `Invalid validation test(s) specified in --${flagName}: ${invalid.join(', ')}. Valid options are: ${optionsToUse.join(', ')}.`
      );
    }

    return split as ValidationTest[];
  };

  const validateValidationFlagValues = (input: string, flagName: string) => {
    parseValidationFlagValues(input, flagName);
    // Can't map the return type here.
    return input;
  };

  const flags: Record<string, Flag<string>> = {
    'skip-validations': Flags.string({
      description: `Comma-separated list of validation tests to skip. Options: ${optionsToUse.join(', ')}. Example: --skip-validations="${optionsToUse[0]}"`,
      exclusive: ['validate-only'],
      parse: async (input) => validateValidationFlagValues(input, 'skip-validations')
    })
  };

  // This only makes sense if we have more than one option
  if (optionsToUse.length > 1) {
    flags['validate-only'] = Flags.string({
      description: `Comma-separated list of validation tests to run, skipping all others. Options: ${optionsToUse.join(', ')}. Example: --validate-only="${optionsToUse[0]}"`,
      exclusive: ['skip-validations'],
      parse: async (input) => validateValidationFlagValues(input, 'validate-only')
    });
  }

  return {
    flags,
    /**
     * Parses the input validation test flags
     * @returns A validation test filter to use.
     */
    parseValidationTestFlags(flags: Record<string, unknown>): ParseValidationsFlagsResult {
      if (flags['skip-validations'] && flags['validate-only']) {
        throw new Error('Cannot specify both --skip-validations and --validate-only flags.');
      } else if (flags['skip-validations']) {
        const toSkip = parseValidationFlagValues(flags['skip-validations'] as string, 'skip-validations');
        return {
          skipped: toSkip,
          testsToRun: optionsToUse.filter((test) => !toSkip.includes(test))
        };
      } else if (flags['validate-only']) {
        const toRun = parseValidationFlagValues(flags['validate-only'] as string, 'validate-only');
        return {
          skipped: optionsToUse.filter((test) => !toRun.includes(test)),
          testsToRun: toRun
        };
      } else {
        return {
          skipped: [],
          testsToRun: optionsToUse
        };
      }
    },
    validateValidationFlagValues
  };
}
