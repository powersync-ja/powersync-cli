import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document } from 'yaml';

import { CLI_FILENAME, parseYamlFile } from '@powersync/cli-core';

export type WriteCloudLinkOptions = {
  instanceId: string;
  orgId: string;
  projectId: string;
};

/**
 * Writes or updates cli.yaml with Cloud instance link (type: cloud, instance_id, org_id, project_id).
 * Creates a new file if it does not exist.
 */
export function writeCloudLink(projectDir: string, options: WriteCloudLinkOptions): void {
  const { instanceId, orgId, projectId } = options;
  const linkPath = join(projectDir, CLI_FILENAME);
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }
  const doc = existsSync(linkPath) ? parseYamlFile(linkPath) : new Document();
  doc.set('type', 'cloud');
  doc.set('instance_id', instanceId);
  doc.set('org_id', orgId);
  doc.set('project_id', projectId);
  writeFileSync(linkPath, doc.toString(), 'utf8');
}
