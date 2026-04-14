import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';

import { createAccountsHubClient, OBJECT_ID_REGEX, resolveCloudInstanceLink } from '@powersync/cli-core';
import { PowerSyncManagementClient } from '@powersync/management-client';

type InstanceConfigResponse = Awaited<ReturnType<PowerSyncManagementClient['getInstanceConfig']>>;

export type CloudLinkValidationInput = {
  instanceId?: string;
  orgId?: string;
  projectId?: string;
};

export type ValidateCloudLinkConfigOptions = {
  cloudClient: PowerSyncManagementClient;
  input: CloudLinkValidationInput;
  validateInstance?: boolean;
};

export type ValidateCloudLinkConfigResult = {
  instanceConfig?: InstanceConfigResponse;
  linked?: ResolvedCloudCLIConfig;
};

function ensureObjectId(value: string | undefined, flagName: '--instance-id' | '--org-id' | '--project-id') {
  if (value == null) {
    return;
  }

  if (!OBJECT_ID_REGEX.test(value)) {
    throw new Error(`Invalid ${flagName} "${value}". Expected a BSON ObjectID (24 hex characters).`);
  }
}

export async function validateCloudLinkConfig(
  options: ValidateCloudLinkConfigOptions
): Promise<ValidateCloudLinkConfigResult> {
  const { cloudClient, input, validateInstance = false } = options;
  const { instanceId, orgId, projectId } = input;

  if (validateInstance) {
    const linked = await resolveCloudInstanceLink({ client: cloudClient, instanceId, orgId, projectId });
    let instanceConfig: InstanceConfigResponse;
    try {
      instanceConfig = await cloudClient.getInstanceConfig({
        app_id: linked.project_id,
        id: linked.instance_id,
        org_id: linked.org_id
      });
    } catch {
      throw new Error(
        `Instance ${linked.instance_id} was not found in project ${linked.project_id} in organization ${linked.org_id}, or is not accessible with the current token.`
      );
    }

    return { instanceConfig, linked };
  }

  if (!orgId || !projectId) {
    throw new Error('Project validation requires both an organization ID and a project ID.');
  }

  ensureObjectId(orgId, '--org-id');
  ensureObjectId(projectId, '--project-id');

  const accountsClient = createAccountsHubClient();

  try {
    await accountsClient.getOrganization({ id: orgId });
  } catch {
    throw new Error(`Organization ${orgId} was not found or is not accessible with the current token.`);
  }

  let projects;
  try {
    projects = await accountsClient.listProjects({ id: projectId, org_id: orgId });
  } catch {
    throw new Error(
      `Project ${projectId} was not found in organization ${orgId}, or is not accessible with the current token.`
    );
  }

  if ((projects.total ?? projects.objects?.length ?? 0) < 1) {
    throw new Error(
      `Project ${projectId} was not found in organization ${orgId}, or is not accessible with the current token.`
    );
  }

  return {};
}
