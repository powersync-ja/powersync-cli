import { createAccountsHubClient, OBJECT_ID_REGEX } from '@powersync/cli-core';
import { PowerSyncManagementClient } from '@powersync/management-client';

type InstanceConfigResponse = Awaited<ReturnType<PowerSyncManagementClient['getInstanceConfig']>>;

export type CloudLinkValidationInput = {
  instanceId?: string;
  orgId: string;
  projectId: string;
};

export type ValidateCloudLinkConfigOptions = {
  cloudClient: PowerSyncManagementClient;
  input: CloudLinkValidationInput;
  validateInstance?: boolean;
};

export type ValidateCloudLinkConfigResult = {
  instanceConfig?: InstanceConfigResponse;
};

function ensureObjectId(value: string, flagName: '--instance-id' | '--org-id' | '--project-id') {
  if (!OBJECT_ID_REGEX.test(value)) {
    throw new Error(`Invalid ${flagName} "${value}". Expected a BSON ObjectID (24 hex characters).`);
  }
}

export async function validateCloudLinkConfig(
  options: ValidateCloudLinkConfigOptions
): Promise<ValidateCloudLinkConfigResult> {
  const { cloudClient, input, validateInstance = false } = options;
  const { instanceId, orgId, projectId } = input;

  ensureObjectId(orgId, '--org-id');
  ensureObjectId(projectId, '--project-id');

  const accountsClient = await createAccountsHubClient();

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

  if (!validateInstance) {
    return {};
  }

  if (!instanceId) {
    throw new Error('Instance validation requested but no instance ID was provided.');
  }

  ensureObjectId(instanceId, '--instance-id');

  try {
    const instanceConfig = await cloudClient.getInstanceConfig({
      app_id: projectId,
      id: instanceId,
      org_id: orgId
    });
    return { instanceConfig };
  } catch {
    throw new Error(
      `Instance ${instanceId} was not found in project ${projectId} in organization ${orgId}, or is not accessible with the current token.`
    );
  }
}
