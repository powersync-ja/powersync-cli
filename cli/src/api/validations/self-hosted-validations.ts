import { SelfHostedProject } from '@powersync/cli-core';

import { runConfigTest, runSyncConfigTestSelfHosted } from './validations.js';
import { ValidationTest, ValidationTestDefinition } from './ValidationTestDefinition.js';

export type RunSelfHostedValidationsOptions = {
  project: SelfHostedProject;
  tests?: ValidationTest[];
};

export function getSelfHostedValidationTests({
  project,
  tests = Object.values(ValidationTest)
}: RunSelfHostedValidationsOptions): ValidationTestDefinition[] {
  const allTests = [
    { name: ValidationTest.CONFIGURATION, run: () => runConfigTest(project.projectDirectory, false) },
    {
      name: ValidationTest.CONNECTIONS,
      async run() {
        return {
          passed: true,
          warnings: ['Connection tests are not currently supported for self-hosted projects.']
        };
      }
    },
    {
      name: ValidationTest['SYNC-CONFIG'],
      async run() {
        return runSyncConfigTestSelfHosted(project);
      }
    }
  ] satisfies ValidationTestDefinition[];
  // Filter based on the input specified
  return allTests.filter((def) => tests.includes(def.name));
}
