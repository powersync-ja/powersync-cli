import { CloudCLIConfig, CloudTargetConfig } from '@powersync/cli-schemas';

import { CLI_FILENAME } from './project-config.js';

export type CloudLink = Partial<CloudTargetConfig> & { target?: string };

/**
 * Picks the link fields a Cloud command should use: the named target when one is selected,
 * otherwise the top-level fields of cli.yaml.
 */
export function selectCloudLink(cliConfig: CloudCLIConfig | null, target?: string): CloudLink {
  if (target == null) {
    return { instance_id: cliConfig?.instance_id, org_id: cliConfig?.org_id, project_id: cliConfig?.project_id };
  }

  const targets = cliConfig?.targets ?? {};
  const link = Object.hasOwn(targets, target) ? targets[target] : undefined;
  if (!link) {
    const available = Object.keys(targets);
    throw new Error(
      available.length > 0
        ? `Target "${target}" is not defined in ${CLI_FILENAME}. Available targets: ${available.join(', ')}.`
        : `Target "${target}" is not defined in ${CLI_FILENAME}. Add it with: powersync link cloud --target=${target} --instance-id=<id>`
    );
  }

  return { ...link, target };
}

/** Suggestion for a missing link when cli.yaml defines targets but none was selected. */
export function suggestTargets(cliConfig: CloudCLIConfig | null): string[] {
  const names = Object.keys(cliConfig?.targets ?? {});
  return names.length > 0
    ? [`Select a target from ${CLI_FILENAME} with --target or POWERSYNC_TARGET: ${names.join(', ')}.`]
    : [];
}
