import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';
import type { PowerSyncManagementClient } from '@powersync/management-client';

import { OBJECT_ID_REGEX } from './object-id.js';

type CloudInstanceMetadata = {
  app_id: string;
  id: string;
  org_id: string;
};

type CloudInstanceResolverClient = PowerSyncManagementClient & {
  getInstance(input: { id: string }): Promise<CloudInstanceMetadata>;
};

export type ResolveCloudInstanceLinkInput = {
  client: PowerSyncManagementClient;
  instanceId?: string;
  orgId?: string;
  projectId?: string;
};

function ensureObjectId(value: string | undefined, label: '--instance-id' | '--org-id' | '--project-id'): void {
  if (value == null) {
    return;
  }

  if (!OBJECT_ID_REGEX.test(value)) {
    throw new Error(`Invalid ${label} "${value}". Expected a BSON ObjectID (24 hex characters).`);
  }
}

/**
 * Resolves the full Cloud link from an instance ID. If org/project IDs are missing, fetches them from the instance.
 */
export async function resolveCloudInstanceLink(input: ResolveCloudInstanceLinkInput): Promise<ResolvedCloudCLIConfig> {
  const { client, instanceId, orgId, projectId } = input;

  ensureObjectId(instanceId, '--instance-id');
  ensureObjectId(orgId, '--org-id');
  ensureObjectId(projectId, '--project-id');

  if (!instanceId) {
    throw new Error('Cloud instance resolution requires an instance ID.');
  }

  if (orgId && projectId) {
    return {
      instance_id: instanceId,
      org_id: orgId,
      project_id: projectId,
      type: 'cloud'
    };
  }

  let instance: CloudInstanceMetadata;
  try {
    instance = await (client as CloudInstanceResolverClient).getInstance({ id: instanceId });
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
