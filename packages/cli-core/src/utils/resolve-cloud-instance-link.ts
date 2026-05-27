import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';
import type { PowerSyncManagementClient } from '@powersync/management-client';

import { ensureObjectId } from './object-id.js';

export type ResolveCloudInstanceLinkInput = {
  client: PowerSyncManagementClient;
  instanceId: string;
  orgId?: string;
  projectId?: string;
};

/**
 * Resolves the full Cloud link from an instance ID. If org/project IDs are missing, fetches them from the instance.
 *
 * Note that this function does NOT check if the org/project IDs reference valid destinations if provided manually.
 */
export async function resolveCloudInstanceLink(input: ResolveCloudInstanceLinkInput): Promise<ResolvedCloudCLIConfig> {
  const { client, instanceId, orgId, projectId } = input;

  ensureObjectId(instanceId, '--instance-id');

  // Skip API request when org and project IDs are both provided; otherwise fetch them via getInstance
  if (orgId && projectId) {
    ensureObjectId(orgId, '--org-id');
    ensureObjectId(projectId, '--project-id');
    return {
      instance_id: instanceId,
      org_id: orgId,
      project_id: projectId,
      type: 'cloud'
    };
  }

  let instance;
  try {
    instance = await client.getInstance({ id: instanceId });
  } catch {
    throw new Error(`Instance ${instanceId} was not found or is not accessible with the current token.`);
  }

  if (orgId && orgId !== instance.org_id) {
    throw new Error(`Instance ${instanceId} belongs to organization ${instance.org_id}, not ${orgId}.`);
  }

  if (projectId && projectId !== instance.app_id) {
    throw new Error(`Instance ${instanceId} belongs to project ${instance.app_id}, not ${projectId}.`);
  }

  return {
    instance_id: instance.id,
    org_id: instance.org_id,
    project_id: instance.app_id,
    type: 'cloud'
  };
}
