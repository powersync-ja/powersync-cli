import { ux } from '@oclif/core';
import { CloudProject, createCloudClient, ValidationTestRunResult } from '@powersync/cli-core';
import { ServiceCloudConfigDecoded } from '@powersync/cli-schemas';
import { routes } from '@powersync/management-types';

import { testCloudConnections } from '../cloud/test-connection.js';
import { mergeValidationTestRunResults } from './validation-utils.js';
import { runConfigTest, runSyncConfigTestCloud } from './validations.js';
import { ValidationTest, ValidationTestDefinition } from './ValidationTestDefinition.js';

export type RunCloudValidationsOptions = {
  cloudConfigState: routes.InstanceConfigResponse;
  project: CloudProject;
  serviceConfigState?: ServiceCloudConfigDecoded;
  tests?: ValidationTest[];
};

/**
 * Validates deploy-specific region invariants as part of the CONFIGURATION test:
 * - Prevents changing the region after initial deployment.
 * - Verifies the configured region is in the list of supported regions.
 */
async function runRegionValidation(params: {
  cloudConfigState: routes.InstanceConfigResponse;
  serviceConfigRegion?: string;
}): Promise<ValidationTestRunResult> {
  const { cloudConfigState, serviceConfigRegion } = params;

  if (!serviceConfigRegion) {
    return {
      errors: [
        'Region is required in the service config for deployment. Please add a region to your config and try again.'
      ],
      passed: false
    };
  }

  const existingRegion = cloudConfigState.config?.region;
  if (existingRegion && existingRegion !== serviceConfigRegion) {
    return {
      errors: [
        `The region cannot be changed after initial deployment.`,
        `Existing region: ${existingRegion}. Configured region: ${serviceConfigRegion}.`
      ],
      passed: false
    };
  }

  const client = createCloudClient();
  try {
    const { regions } = await client.listRegions();
    const correspondingRegion = regions.find((r) => r.name === serviceConfigRegion);
    if (!correspondingRegion) {
      return {
        errors: [
          `The region ${serviceConfigRegion} is not supported. Please choose a region from the list of supported regions: ${regions.map((r) => r.name).join(', ')}.`
        ],
        passed: false
      };
    }

    return { passed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { errors: [`Could not validate region against list of regions: ${message}`], passed: false };
  }
}

/**
 * Returns the subset of cloud validation test definitions matching the requested test names.
 * Passing no `tests` runs all available cloud validations.
 */
export function getCloudValidations({
  cloudConfigState,
  project,
  serviceConfigState,
  tests = Object.values(ValidationTest)
}: RunCloudValidationsOptions): ValidationTestDefinition[] {
  const client = createCloudClient();

  const allTestDefinitions: ValidationTestDefinition[] = [
    {
      name: ValidationTest.CONFIGURATION,
      async run() {
        const configResult = await runConfigTest(project.projectDirectory, true);
        if (!configResult.passed) return configResult;

        const regionResult = await runRegionValidation({
          cloudConfigState,
          serviceConfigRegion: serviceConfigState?.region
        });

        return mergeValidationTestRunResults(configResult, regionResult);
      }
    },
    {
      name: ValidationTest.CONNECTIONS,
      async run() {
        if (!serviceConfigState) {
          return { errors: ['Service config file not found. Cannot test connections.'], passed: false };
        }

        const connections = serviceConfigState.replication?.connections ?? [];
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
        const status = await client.getInstanceStatus({
          app_id: project.linked.project_id,
          id: project.linked.instance_id,
          org_id: project.linked.org_id
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

        return runSyncConfigTestCloud(project);
      }
    }
  ];

  return allTestDefinitions.filter((def) => tests.includes(def.name));
}
