import { describe, expect, it } from 'vitest';

import {
  GENERAL_VALIDATION_FLAG_HELPERS,
  generateValidationTestFlags
} from '../../../src/api/validations/validation-flags.js';
import { ValidationTest } from '../../../src/api/validations/ValidationTestDefinition.js';

const ALL_TESTS = Object.values(ValidationTest);

describe('generateValidationTestFlags', () => {
  describe('flag generation', () => {
    it('generates both skip-validations and validate-only flags when there are multiple options', () => {
      const { flags } = generateValidationTestFlags();
      expect(flags['skip-validations']).toBeDefined();
      expect(flags['validate-only']).toBeDefined();
    });

    it('generates only skip-validations when limitOptions has a single entry', () => {
      const { flags } = generateValidationTestFlags({ limitOptions: [ValidationTest.CONFIGURATION] });
      expect(flags['skip-validations']).toBeDefined();
      expect(flags['validate-only']).toBeUndefined();
    });

    it('generates both flags when limitOptions has multiple entries', () => {
      const { flags } = generateValidationTestFlags({
        limitOptions: [ValidationTest.CONFIGURATION, ValidationTest.CONNECTIONS]
      });
      expect(flags['skip-validations']).toBeDefined();
      expect(flags['validate-only']).toBeDefined();
    });
  });

  describe('parseValidationTestFlags', () => {
    describe('with no flags', () => {
      it('returns all tests with nothing skipped', () => {
        const result = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({});
        expect(result.skipped).toEqual([]);
        expect(result.testsToRun).toEqual(ALL_TESTS);
      });
    });

    describe('--skip-validations', () => {
      it('skips a single specified test and runs the rest', () => {
        const result = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
          'skip-validations': ValidationTest.CONFIGURATION
        });
        expect(result.skipped).toEqual([ValidationTest.CONFIGURATION]);
        expect(result.testsToRun).not.toContain(ValidationTest.CONFIGURATION);
        expect(result.testsToRun).toContain(ValidationTest.CONNECTIONS);
        expect(result.testsToRun).toContain(ValidationTest['SYNC-CONFIG']);
      });

      it('skips multiple comma-separated tests', () => {
        const result = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
          'skip-validations': `${ValidationTest.CONFIGURATION},${ValidationTest.CONNECTIONS}`
        });
        expect(result.skipped).toEqual([ValidationTest.CONFIGURATION, ValidationTest.CONNECTIONS]);
        expect(result.testsToRun).toEqual([ValidationTest['SYNC-CONFIG']]);
      });

      it('skips all tests when all are specified', () => {
        const result = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
          'skip-validations': ALL_TESTS.join(',')
        });
        expect(result.skipped).toEqual(ALL_TESTS);
        expect(result.testsToRun).toEqual([]);
      });

      it('throws for an invalid test name', () => {
        expect(() =>
          GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
            'skip-validations': 'not-a-real-test'
          })
        ).toThrow(/Invalid validation test\(s\) specified in --skip-validations/);
      });

      it('throws when mixed with a valid and an invalid test name', () => {
        expect(() =>
          GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
            'skip-validations': `${ValidationTest.CONFIGURATION},bad-test`
          })
        ).toThrow(/bad-test/);
      });
    });

    describe('--validate-only', () => {
      it('runs only the specified test and skips the rest', () => {
        const result = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
          'validate-only': ValidationTest.CONNECTIONS
        });
        expect(result.testsToRun).toEqual([ValidationTest.CONNECTIONS]);
        expect(result.skipped).not.toContain(ValidationTest.CONNECTIONS);
        expect(result.skipped).toContain(ValidationTest.CONFIGURATION);
        expect(result.skipped).toContain(ValidationTest['SYNC-CONFIG']);
      });

      it('runs multiple comma-separated tests and skips the rest', () => {
        const result = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
          'validate-only': `${ValidationTest.CONFIGURATION},${ValidationTest['SYNC-CONFIG']}`
        });
        expect(result.testsToRun).toEqual([ValidationTest.CONFIGURATION, ValidationTest['SYNC-CONFIG']]);
        expect(result.skipped).toEqual([ValidationTest.CONNECTIONS]);
      });

      it('trims whitespace around comma-separated values', () => {
        const result = GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
          'validate-only': ` ${ValidationTest.CONFIGURATION} , ${ValidationTest.CONNECTIONS} `
        });
        expect(result.testsToRun).toEqual([ValidationTest.CONFIGURATION, ValidationTest.CONNECTIONS]);
      });

      it('throws for an invalid test name', () => {
        expect(() =>
          GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
            'validate-only': 'not-a-real-test'
          })
        ).toThrow(/Invalid validation test\(s\) specified in --validate-only/);
      });

      it('includes the invalid value and valid options in the error message', () => {
        expect(() =>
          GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
            'validate-only': 'bad-value'
          })
        ).toThrow(new RegExp(`bad-value.*Valid options are:.*${ALL_TESTS.join(', ')}`));
      });
    });

    describe('mutual exclusion', () => {
      it('throws when both --skip-validations and --validate-only are provided', () => {
        expect(() =>
          GENERAL_VALIDATION_FLAG_HELPERS.parseValidationTestFlags({
            'skip-validations': ValidationTest.CONFIGURATION,
            'validate-only': ValidationTest.CONNECTIONS
          })
        ).toThrow('Cannot specify both --skip-validations and --validate-only flags.');
      });
    });
  });

  describe('with limitOptions', () => {
    it('only allows tests within the limited set for skip-validations', () => {
      const { parseValidationTestFlags } = generateValidationTestFlags({
        limitOptions: [ValidationTest.CONFIGURATION, ValidationTest.CONNECTIONS]
      });

      expect(() => parseValidationTestFlags({ 'skip-validations': ValidationTest['SYNC-CONFIG'] })).toThrow(
        /Invalid validation test/
      );
    });

    it('only allows tests within the limited set for validate-only', () => {
      const { parseValidationTestFlags } = generateValidationTestFlags({
        limitOptions: [ValidationTest.CONFIGURATION, ValidationTest.CONNECTIONS]
      });

      expect(() => parseValidationTestFlags({ 'validate-only': ValidationTest['SYNC-CONFIG'] })).toThrow(
        /Invalid validation test/
      );
    });

    it('runs only within the limited set when no flags provided', () => {
      const { parseValidationTestFlags } = generateValidationTestFlags({
        limitOptions: [ValidationTest.CONFIGURATION, ValidationTest.CONNECTIONS]
      });

      const result = parseValidationTestFlags({});
      expect(result.testsToRun).toEqual([ValidationTest.CONFIGURATION, ValidationTest.CONNECTIONS]);
      expect(result.skipped).toEqual([]);
    });
  });
});
