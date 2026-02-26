import { Config } from '@oclif/core';
import { vi } from 'vitest';

// Normalize env so tests don't inherit real linking values
delete process.env.INSTANCE_ID;
delete process.env.ORG_ID;
delete process.env.PROJECT_ID;

export const MOCK_CLOUD_IDS = {
  instanceId: '699f191ade6e1187bd89815b',
  orgId: '4ffabc821ea10f9b2a000001',
  projectId: '699ef9c371c56d0007320543'
} as const;

export const managementClientMock = {
  createInstance: vi.fn(),
  deactivateInstance: vi.fn(),
  deployInstance: vi.fn(),
  getInstanceConfig: vi.fn(),
  getInstanceStatus: vi.fn(),
  listRegions: vi.fn(),
  testConnection: vi.fn(),
  validateSyncRules: vi.fn()
};

export function resetManagementClientMocks(): void {
  managementClientMock.createInstance.mockResolvedValue({ id: MOCK_CLOUD_IDS.instanceId });
  managementClientMock.deactivateInstance.mockRejectedValue(new Error('mock deactivate failure'));
  managementClientMock.deployInstance.mockRejectedValue(new Error('mock deploy failure'));
  managementClientMock.getInstanceConfig.mockRejectedValue(new Error('mock getInstanceConfig failure'));
  managementClientMock.getInstanceStatus.mockRejectedValue(new Error('mock getInstanceStatus failure'));
  managementClientMock.listRegions.mockResolvedValue({ regions: [{ name: 'us' }] });
  managementClientMock.testConnection.mockResolvedValue({
    configuration: { success: true },
    connection: { reachable: true, success: true },
    success: true
  });
  managementClientMock.validateSyncRules.mockResolvedValue({ errors: [] });
}

resetManagementClientMocks();

class MockPowerSyncManagementClient {
  constructor() {
    // eslint-disable-next-line no-constructor-return
    return managementClientMock;
  }
}

vi.mock('@powersync/management-client', () => ({
  PowerSyncManagementClient: MockPowerSyncManagementClient
}));

import { root } from './helpers/root.js';

/**
 * Load Config from package root so runCommand uses the correct root.
 * Fails fast if config cannot be loaded.
 */
await Config.load({ root });
