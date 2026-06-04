import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';

import { createAccountsHubClient, ensureObjectId, resolveCloudInstanceLink } from '@powersync/cli-core';
import { PowerSyncManagementClient } from '@powersync/management-client';

type InstanceConfigResponse = Awaited<ReturnType<PowerSyncManagementClient['getInstanceConfig']>>;

export type ValidateCloudProjectOptions = {
  cloudClient: PowerSyncManagementClient;
  orgId: string;
  projectId: string;
};

export type FetchCloudInstanceConfigOptions = {
  cloudClient: PowerSyncManagementClient;
  instanceId: string;
  orgId?: string;
  projectId?: string;
};

export type FetchCloudInstanceConfigResult = {
  instanceConfig: InstanceConfigResponse;
  linked: ResolvedCloudCLIConfig;
};

export async function validateCloudProject(options: ValidateCloudProjectOptions): Promise<void> {
  const { orgId, projectId } = options;

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
}

export async function fetchCloudInstanceConfig(
  options: FetchCloudInstanceConfigOptions
): Promise<FetchCloudInstanceConfigResult> {
  const { cloudClient, instanceId, orgId, projectId } = options;

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
