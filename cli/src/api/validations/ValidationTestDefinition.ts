import { ValidationTestRunResult } from '@powersync/cli-core';

/**
 * Definition of a test: display name and async runner function.
 */
export type ValidationTestDefinition = {
  name: ValidationTest;
  run: () => Promise<ValidationTestRunResult>;
};

/**
 * Runtime test entry, storing the in-flight promise and optional settled result.
 */
export type ValidationTestResultEntry = {
  name: string;
  result?: ValidationTestRunResult;
};

/**
 * Named test buckets used by the validate command.
 */
export enum ValidationTest {
  'CONFIGURATION' = 'configuration',
  'CONNECTIONS' = 'connections',
  'SYNC-CONFIG' = 'sync-config'
}
