import { ux } from '@oclif/core';
import { AdditionalCloudConfigFields, ServiceCloudConfigDecoded } from '@powersync/cli-schemas';
import { routes } from '@powersync/management-types';
import { structuredPatch } from 'diff';
import isEqual from 'lodash/isEqual.js';

import { decodeFetchedCloudConfig } from './cloud/fetch-cloud-config.js';

const CLI_ONLY_FIELDS = new Set(Object.keys(AdditionalCloudConfigFields.props.shape));

function colorizeDiffLine(line: string): string {
  if (line.startsWith('+')) return ux.colorize('green', line);
  if (line.startsWith('-')) return ux.colorize('red', line);
  return line;
}

/**
 * Names the top-level service config sections whose local value differs from the deployed one.
 * Returns undefined when the deployed config cannot be decoded for comparison.
 */
export function changedServiceConfigSections(
  localConfig: ServiceCloudConfigDecoded,
  cloudConfigState: routes.InstanceConfigResponse
): string[] | undefined {
  let deployed: Record<string, unknown>;
  try {
    deployed = decodeFetchedCloudConfig(cloudConfigState).config as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const local = localConfig as Record<string, unknown>;
  const sections = new Set([...Object.keys(deployed), ...Object.keys(local)]);
  return [...sections]
    .filter((section) => !CLI_ONLY_FIELDS.has(section) && !isEqual(local[section], deployed[section]))
    .sort();
}

/** Unified diff of the deployed sync config against the local one, one colorized entry per line. Empty when identical. */
export function formatSyncConfigDiff(deployed: string, local: string): string[] {
  const { hunks } = structuredPatch('deployed', 'local', deployed, local);
  return hunks.flatMap((hunk) => [
    ux.colorize('cyan', `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`),
    ...hunk.lines.map((line) => colorizeDiffLine(line))
  ]);
}
