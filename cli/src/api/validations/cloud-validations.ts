import { ux } from '@oclif/core';
import { CloudProject, createCloudClient } from '@powersync/cli-core';
import { ServiceCloudConfigDecoded } from '@powersync/cli-schemas';

import { testCloudConnections } from '../cloud/test-connection.js';
import { parseCloudConfig, runConfigTest, runSyncConfigTestCloud } from './validations.js';
import { ValidationTest, ValidationTestDefinition } from './ValidationTestDefinition.js';

export type RunCloudValidationsOptions = {
  project: CloudProject;
  tests?: ValidationTest[];
};

/**
 * Returns the subset of cloud validation test definitions matching the requested test names.
 * Passing no `tests` runs all available cloud validations.
 */
export function getCloudValidations({
  project,
  tests = Object.values(ValidationTest)
}: RunCloudValidationsOptions): ValidationTestDefinition[] {
  const allTestDefinitions: ValidationTestDefinition[] = [
    { name: ValidationTest.CONFIGURATION, run: () => runConfigTest(project.projectDirectory, true) },
    {
      name: ValidationTest.CONNECTIONS,
      async run() {
        const client = createCloudClient();
        let config: ServiceCloudConfigDecoded;
        try {
          config = parseCloudConfig(project.projectDirectory);
        } catch (error) {
          return {
            errors: [`Could not parse config: ${error}`],
            passed: false
          };
        }

        const connections = config.replication?.connections ?? [];
        if (connections.length === 0) {
          return { errors: ['No connections defined in config.'], passed: false };
        }

        try {
          const results = await testCloudConnections(client, project.linked, connections);
          const failed = results.filter((r) => r.response.success !== true);
          if (failed.length === 0) {
            return { passed: true };
          }

          const errors = failed.map((f) => `${f.connectionName}: ${f.response.error ?? 'Connection test failed'}`);
          return { errors, passed: false };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { errors: [message], passed: false };
        }
      }
    },
    {
      name: ValidationTest['SYNC-CONFIG'],
      async run() {
        // We can only validate sync rules against a provisioned instance, so ensure that's the case before running the test.
        const client = createCloudClient();
        const cloudProject = project as CloudProject;

        const status = await client.getInstanceStatus({
          app_id: cloudProject.linked.project_id,
          id: cloudProject.linked.instance_id,
          org_id: cloudProject.linked.org_id
        });
        if (!status.provisioned) {
          return {
            errors: [
              `Linked instance is not provisioned. Sync config validation requires a provisioned instance.`,
              `Deploy the instance, with ${ux.colorize('blue', 'powersync deploy')}, before validating sync config.`
            ],
            passed: false
          };
        }

        return runSyncConfigTestCloud(project as CloudProject);
      }
    }
  ];

  return allTestDefinitions.filter((def) => tests.includes(def.name));
}
