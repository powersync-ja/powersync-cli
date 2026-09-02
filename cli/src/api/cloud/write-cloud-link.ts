import { CLI_FILENAME, parseYamlFile } from '@powersync/cli-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document } from 'yaml';

export type WriteCloudLinkOptions = {
  /** Store the link under environments.<name> instead of the top-level fields. */
  environment?: string;
  instanceId: string;
  orgId: string;
  projectId: string;
};

/**
 * Writes or updates cli.yaml with a Cloud instance link (type: cloud, instance_id, org_id, project_id),
 * either at the top level or under a named environment. Creates a new file if it does not exist.
 */
export function writeCloudLink(projectDir: string, options: WriteCloudLinkOptions): void {
  const { environment, instanceId, orgId, projectId } = options;
  const linkPath = join(projectDir, CLI_FILENAME);
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  const doc = existsSync(linkPath) ? parseYamlFile(linkPath) : new Document();
  const basePath = environment ? ['environments', environment] : [];
  doc.set('type', 'cloud');
  doc.setIn([...basePath, 'instance_id'], instanceId);
  doc.setIn([...basePath, 'org_id'], orgId);
  doc.setIn([...basePath, 'project_id'], projectId);
  writeFileSync(linkPath, doc.toString(), 'utf8');
}
