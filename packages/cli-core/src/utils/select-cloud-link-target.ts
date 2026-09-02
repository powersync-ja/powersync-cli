import { CloudCLIConfig, CloudEnvironmentConfig } from '@powersync/cli-schemas';

import { CLI_FILENAME } from './project-config.js';

export type CloudLinkTarget = Partial<CloudEnvironmentConfig> & { environment?: string };

/**
 * Picks the link fields a Cloud command should use: the named environment when one is selected,
 * otherwise the top-level fields of cli.yaml.
 */
export function selectCloudLinkTarget(cliConfig: CloudCLIConfig | null, environment?: string): CloudLinkTarget {
  if (environment == null) {
    return { instance_id: cliConfig?.instance_id, org_id: cliConfig?.org_id, project_id: cliConfig?.project_id };
  }

  const environments = cliConfig?.environments ?? {};
  const target = environments[environment];
  if (!target) {
    const available = Object.keys(environments);
    throw new Error(
      available.length > 0
        ? `Environment "${environment}" is not defined in ${CLI_FILENAME}. Available environments: ${available.join(', ')}.`
        : `Environment "${environment}" is not defined in ${CLI_FILENAME}. Add it with: powersync link cloud --environment=${environment} --instance-id=<id>`
    );
  }

  return { ...target, environment };
}

/** Suggestion for a missing link when cli.yaml defines environments but none was selected. */
export function suggestEnvironments(cliConfig: CloudCLIConfig | null): string[] {
  const names = Object.keys(cliConfig?.environments ?? {});
  return names.length > 0
    ? [`Select an environment from ${CLI_FILENAME} with --environment or POWERSYNC_ENVIRONMENT: ${names.join(', ')}.`]
    : [];
}
