import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';

import { PowerSyncManagementClient } from '@powersync/management-client';

const STATUS_POLL_INTERVAL_MS = 5000;
export const DEFAULT_DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;

type DeployStatus = 'completed' | 'failed' | 'pending' | 'running';

export type WaitForOperationParams = {
  client: PowerSyncManagementClient;
  instanceId: string;
  linked: ResolvedCloudCLIConfig;
  operationId: string;
  timeoutMs?: number;
};

/**
 * Waits for the deployment operation to complete by polling the instance status until it detects a 'completed' or 'failed' status, or until a timeout is reached. Returns the final status of the deployment operation.
 */
export async function waitForOperationStatusChange(params: WaitForOperationParams): Promise<DeployStatus> {
  const { client, instanceId, linked, operationId, timeoutMs = DEFAULT_DEPLOY_TIMEOUT_MS } = params;
  const startedAt = Date.now();
  for (;;) {
    const result = await client.getInstanceStatus({
      app_id: linked.project_id,
      id: instanceId,
      org_id: linked.org_id
    });
    const operation = result.operations?.find((op) => op.id === operationId);
    if (!operation) {
      throw new Error(`Operation with ID ${operationId} not found for instance ${instanceId}.`);
    }

    const status = operation.status as DeployStatus | undefined;
    if (status === 'failed' || status === 'completed') return status;
    if (status === undefined) {
      // No operation or unknown status; treat as failed to avoid infinite loop
      return 'failed';
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        `Deployment did not complete within ${Math.round(timeoutMs / 1000)} seconds. Check instance status and try again.`
      );
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, STATUS_POLL_INTERVAL_MS);
    });
  }
}
