import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LINK_FILENAME, loadLinkDocument } from '../../utils/project-config.js';

export type WriteCloudLinkOptions = {
  instanceId: string;
  orgId: string;
  projectId: string;
};

/**
 * Writes or updates link.yaml with Cloud instance link (type: cloud, instance_id, org_id, project_id).
 */
export function writeCloudLink(projectDir: string, options: WriteCloudLinkOptions): void {
  const { instanceId, orgId, projectId } = options;
  const linkPath = join(projectDir, LINK_FILENAME);
  const doc = loadLinkDocument(linkPath);
  doc.set('type', 'cloud');
  doc.set('instance_id', instanceId);
  doc.set('org_id', orgId);
  doc.set('project_id', projectId);
  writeFileSync(linkPath, doc.toString(), 'utf8');
}
