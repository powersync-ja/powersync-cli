import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CLI_FILENAME, parseYamlFile } from '@powersync/cli-core';

export type WriteCloudLinkOptions = {
  instanceId: string;
  orgId: string;
  projectId: string;
};

/**
 * Writes or updates cli.yaml with Cloud instance link (type: cloud, instance_id, org_id, project_id).
 */
export function writeCloudLink(projectDir: string, options: WriteCloudLinkOptions): void {
  const { instanceId, orgId, projectId } = options;
  const linkPath = join(projectDir, CLI_FILENAME);
  const doc = parseYamlFile(linkPath);
  doc.set('type', 'cloud');
  doc.set('instance_id', instanceId);
  doc.set('org_id', orgId);
  doc.set('project_id', projectId);
  writeFileSync(linkPath, doc.toString(), 'utf8');
}
