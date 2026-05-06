import type { PowerSyncManagementClient } from '@powersync/management-client';

import { resolveCloudInstanceLink } from '@powersync/cli-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../setup.js';

const { instanceId: INSTANCE_ID, orgId: ORG_ID, projectId: PROJECT_ID } = MOCK_CLOUD_IDS;
const OTHER_ORG_ID = '4ffabc821ea10f9b2a000002';
const OTHER_PROJECT_ID = '699ef9c371c56d0007320544';

const mockClient = managementClientMock as unknown as PowerSyncManagementClient;

describe('resolveCloudInstanceLink', () => {
  beforeEach(() => {
    resetManagementClientMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when no instanceId is provided', async () => {
    await expect(resolveCloudInstanceLink({ client: mockClient })).rejects.toThrow(
      'Cloud instance resolution requires an instance ID.'
    );
    expect(managementClientMock.getInstance).not.toHaveBeenCalled();
  });

  it('throws when instanceId has an invalid format', async () => {
    await expect(resolveCloudInstanceLink({ client: mockClient, instanceId: 'not-a-valid-id' })).rejects.toThrow(
      'Invalid --instance-id'
    );
    expect(managementClientMock.getInstance).not.toHaveBeenCalled();
  });

  describe('when both orgId and projectId are provided', () => {
    it('returns the resolved link without an API call', async () => {
      const result = await resolveCloudInstanceLink({
        client: mockClient,
        instanceId: INSTANCE_ID,
        orgId: ORG_ID,
        projectId: PROJECT_ID
      });
      expect(result).toEqual({ instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID, type: 'cloud' });
      expect(managementClientMock.getInstance).not.toHaveBeenCalled();
    });

    it('throws when orgId has an invalid format', async () => {
      await expect(
        resolveCloudInstanceLink({
          client: mockClient,
          instanceId: INSTANCE_ID,
          orgId: 'bad-org',
          projectId: PROJECT_ID
        })
      ).rejects.toThrow('Invalid --org-id');
      expect(managementClientMock.getInstance).not.toHaveBeenCalled();
    });

    it('throws when projectId has an invalid format', async () => {
      await expect(
        resolveCloudInstanceLink({
          client: mockClient,
          instanceId: INSTANCE_ID,
          orgId: ORG_ID,
          projectId: 'bad-project'
        })
      ).rejects.toThrow('Invalid --project-id');
      expect(managementClientMock.getInstance).not.toHaveBeenCalled();
    });
  });

  describe('when org or project IDs are missing (API lookup path)', () => {
    it('throws when orgId has an invalid format before calling the API', async () => {
      await expect(
        resolveCloudInstanceLink({ client: mockClient, instanceId: INSTANCE_ID, orgId: 'bad-org' })
      ).rejects.toThrow('Invalid --org-id');
      expect(managementClientMock.getInstance).not.toHaveBeenCalled();
    });

    it('throws when projectId has an invalid format before calling the API', async () => {
      await expect(
        resolveCloudInstanceLink({ client: mockClient, instanceId: INSTANCE_ID, projectId: 'bad-project' })
      ).rejects.toThrow('Invalid --project-id');
      expect(managementClientMock.getInstance).not.toHaveBeenCalled();
    });

    it('throws when the instance is not found', async () => {
      managementClientMock.getInstance.mockRejectedValueOnce(new Error('not found'));
      await expect(resolveCloudInstanceLink({ client: mockClient, instanceId: INSTANCE_ID })).rejects.toThrow(
        `Instance ${INSTANCE_ID} was not found or is not accessible with the current token.`
      );
    });

    it('resolves all fields from the instance when only instanceId is provided', async () => {
      const result = await resolveCloudInstanceLink({ client: mockClient, instanceId: INSTANCE_ID });
      expect(result).toEqual({ instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID, type: 'cloud' });
      expect(managementClientMock.getInstance).toHaveBeenCalledWith({ id: INSTANCE_ID });
    });

    it('throws when the provided orgId does not match the instance', async () => {
      await expect(
        resolveCloudInstanceLink({ client: mockClient, instanceId: INSTANCE_ID, orgId: OTHER_ORG_ID })
      ).rejects.toThrow(`Instance ${INSTANCE_ID} belongs to organization ${ORG_ID}, not ${OTHER_ORG_ID}.`);
    });

    it('throws when the provided projectId does not match the instance', async () => {
      await expect(
        resolveCloudInstanceLink({ client: mockClient, instanceId: INSTANCE_ID, projectId: OTHER_PROJECT_ID })
      ).rejects.toThrow(`Instance ${INSTANCE_ID} belongs to project ${PROJECT_ID}, not ${OTHER_PROJECT_ID}.`);
    });

    it('resolves correctly when instanceId and a matching orgId are provided', async () => {
      const result = await resolveCloudInstanceLink({ client: mockClient, instanceId: INSTANCE_ID, orgId: ORG_ID });
      expect(result).toEqual({ instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID, type: 'cloud' });
    });

    it('resolves correctly when instanceId and a matching projectId are provided', async () => {
      const result = await resolveCloudInstanceLink({
        client: mockClient,
        instanceId: INSTANCE_ID,
        projectId: PROJECT_ID
      });
      expect(result).toEqual({ instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID, type: 'cloud' });
    });
  });
});
