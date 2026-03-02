import { PowerSyncManagementClient } from '@powersync/management-client';
import { vi } from 'vitest';

/** Stub used as the cloud client in tests. Created once, returned by createCloudClient and exposed for mocking. */
const stub: PowerSyncManagementClient = {
  createInstance: vi.fn(),
  getInstanceConfig: vi.fn(),
  getInstanceDiagnostics: vi.fn(),
  getInstanceStatus: vi.fn()
} as unknown as PowerSyncManagementClient;

/**
 * Returns the last (and only) created cloud client stub.
 * Use in tests to set up mocks, e.g. getLastCloudClient().getInstanceConfig.mockResolvedValueOnce(...).
 */
export function getLastCloudClient(): PowerSyncManagementClient {
  return stub;
}

/**
 * Test double for createCloudClient. Returns the same stub so tests can configure it via getLastCloudClient().
 */
export function createCloudClient(): PowerSyncManagementClient {
  return stub;
}
