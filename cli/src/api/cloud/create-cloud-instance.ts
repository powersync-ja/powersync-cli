import type { PowerSyncManagementClient } from '@powersync/management-client';

export type CreateCloudInstanceOptions = {
  orgId: string;
  projectId: string;
  name: string;
  region: string;
};

export type CreateCloudInstanceResult = {
  instanceId: string;
};

/**
 * Creates a new PowerSync Cloud instance in the given org and project.
 * Uses the management API (e.g. createInstance). Caller should handle errors.
 */
export async function createCloudInstance(
  client: PowerSyncManagementClient,
  options: CreateCloudInstanceOptions
): Promise<CreateCloudInstanceResult> {
  const { orgId, projectId, name, region } = options;

  // validate the region against the list of regions returned by the client.listRegions() method
  const regions = await client.listRegions();
  if (!regions.regions.some((r) => r.name === region)) {
    throw new Error(
      `Region ${region} is not supported. Please choose a region from the list of supported regions: ${regions.regions.map((r) => r.name).join(', ')}.`
    );
  }

  const result = await client.createInstance({
    org_id: orgId,
    app_id: projectId,
    name,
    region
  });
  return { instanceId: result.id };
}
