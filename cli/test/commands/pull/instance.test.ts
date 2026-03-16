import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import * as cliCore from '@powersync/cli-core';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import PullInstanceCommand from '../../../src/commands/pull/instance.js';
import { root } from '../../helpers/root.js';
import { MOCK_CLOUD_IDS } from '../../setup.js';

const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';
const INSTANCE_ID = MOCK_CLOUD_IDS.instanceId;
const ORG_ID = MOCK_CLOUD_IDS.orgId;
const PROJECT_ID = MOCK_CLOUD_IDS.projectId;

/** Minimal valid cloud config decodable by ServiceCloudConfig. */
const MOCK_CONFIG = { _type: 'cloud' as const, name: 'test-instance', region: 'us' };

const MOCK_CONFIG_WITH_EMPTY_JWKS_KEYS = {
  _type: 'cloud' as const,
  client_auth: {
    jwks: {
      keys: []
    },
    supabase: false
  },
  name: 'test-instance',
  region: 'us'
};

const mockCloudClient = {
  deployInstance: vi.fn(),
  getInstanceConfig: vi.fn()
};

const accountsClientMock = {
  getOrganization: vi.fn(),
  listProjects: vi.fn()
};

vi.spyOn(cliCore, 'createAccountsHubClient').mockImplementation(
  () => accountsClientMock as unknown as ReturnType<typeof cliCore.createAccountsHubClient>
);

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\nregion: us\n`, 'utf8');
}

describe('pull instance', () => {
  let oclifConfig: Config;
  let tmpDir: string;
  let origCwd: string;

  beforeAll(async () => {
    oclifConfig = await Config.load({ root });
  });

  function runPullInstanceDirect(opts?: {
    directory?: string;
    instanceId?: string;
    orgId?: string;
    projectId?: string;
  }) {
    const directory = opts?.directory ?? PROJECT_DIR;
    const args = ['--directory', directory];
    if (opts?.instanceId) args.push('--instance-id', opts.instanceId);
    if (opts?.orgId) args.push('--org-id', opts.orgId);
    if (opts?.projectId) args.push('--project-id', opts.projectId);
    const cmd = new PullInstanceCommand(args, oclifConfig);
    cmd.client = mockCloudClient as unknown as PowerSyncManagementClient;
    return captureOutput(() => cmd.run());
  }

  beforeEach(() => {
    origCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'pull-instance-test-'));
    process.chdir(tmpDir);
    mockCloudClient.getInstanceConfig.mockReset();
    mockCloudClient.getInstanceConfig.mockRejectedValue(new Error('network error'));
    accountsClientMock.getOrganization.mockResolvedValue({ id: ORG_ID, label: 'Test Org' });
    accountsClientMock.listProjects.mockResolvedValue({
      objects: [{ id: PROJECT_ID, name: 'Test Project' }],
      total: 1
    });
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('errors when directory does not exist and no link args', async () => {
    const result = await runPullInstanceDirect();
    expect(result.error?.message).toContain(`Directory "${PROJECT_DIR}" not found`);
    expect(result.error?.message).toContain('--instance-id');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('when directory does not exist but link args given, creates directory and writes config', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    expect(existsSync(projectDir)).toBe(false);
    mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
    const result = await runPullInstanceDirect({
      instanceId: INSTANCE_ID,
      orgId: ORG_ID,
      projectId: PROJECT_ID
    });
    expect(result.error).toBeUndefined();
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'cli.yaml'))).toBe(true);
    expect(existsSync(join(projectDir, SERVICE_FILENAME))).toBe(true);
    const serviceYaml = readFileSync(join(projectDir, SERVICE_FILENAME), 'utf8');
    expect(serviceYaml).toContain('_type: cloud');
    expect(serviceYaml).toContain('PowerSync Cloud config');
    expect(serviceYaml).toContain('[optional] Use the same JWT secret as Supabase. Default: false.');
    expect(serviceYaml).toContain('HMAC (symmetric)');
    expect(result.stdout).toContain('Created');
    expect(result.stdout).toContain(`Wrote ${SERVICE_FILENAME}`);
  });

  it('errors when cli.yaml does not exist and no link flags', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    const result = await runPullInstanceDirect();
    expect(result.error?.message).toContain('Linking is required');
    expect(result.error?.message).toContain('--instance-id');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('when link does not exist but flags provided, creates link and writes service.yaml', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    // No service.yaml; ensureServiceTypeMatches allows missing when configFileRequired is false
    mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
    const result = await runPullInstanceDirect({
      instanceId: INSTANCE_ID,
      orgId: ORG_ID,
      projectId: PROJECT_ID
    });
    expect(result.error).toBeUndefined();
    expect(existsSync(join(projectDir, 'cli.yaml'))).toBe(true);
    expect(readFileSync(join(projectDir, 'cli.yaml'), 'utf8')).toContain(`instance_id: ${INSTANCE_ID}`);
    expect(result.stdout).toContain('Created');
    expect(result.stdout).toContain('cli.yaml');
    expect(result.stdout).toContain(`Wrote ${SERVICE_FILENAME}`);
    expect(existsSync(join(projectDir, SERVICE_FILENAME))).toBe(true);
    expect(readFileSync(join(projectDir, SERVICE_FILENAME), 'utf8')).toContain('_type: cloud');
  });

  describe('when already linked', () => {
    beforeEach(() => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(
        join(projectDir, 'cli.yaml'),
        `type: cloud\ninstance_id: ${INSTANCE_ID}\norg_id: ${ORG_ID}\nproject_id: ${PROJECT_ID}\n`,
        'utf8'
      );
    });

    it('writes service.yaml when client succeeds', async () => {
      mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
      const result = await runPullInstanceDirect();
      expect(result.error).toBeUndefined();
      const projectDir = join(tmpDir, PROJECT_DIR);
      expect(existsSync(join(projectDir, SERVICE_FILENAME))).toBe(true);
      expect(readFileSync(join(projectDir, SERVICE_FILENAME), 'utf8')).toContain('_type: cloud');
      expect(result.stdout).toContain(`Wrote ${SERVICE_FILENAME}`);
    });

    it('renders jwks key examples without an empty [] placeholder', async () => {
      mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG_WITH_EMPTY_JWKS_KEYS });
      const result = await runPullInstanceDirect();
      expect(result.error).toBeUndefined();

      const projectDir = join(tmpDir, PROJECT_DIR);
      const serviceYaml = readFileSync(join(projectDir, SERVICE_FILENAME), 'utf8');

      expect(serviceYaml).toContain('jwks:');
      expect(serviceYaml).toContain('keys:');
      expect(serviceYaml).toContain('HMAC (symmetric)');
      expect(serviceYaml).not.toMatch(/\n\s*\[\]\s*\n\s*# HMAC/);
      expect(serviceYaml).not.toMatch(
        /\n\s*# \[optional\] Use the same JWT secret as Supabase\. Default: false\.\n\s*# \[optional\] Inline JWKS; provide keys directly instead of or in addition to jwks_uri\.\n\s*jwks:/
      );
      expect(serviceYaml).not.toContain('jwks:\n    {}');
    });

    it('errors when client fails', async () => {
      const result = await runPullInstanceDirect();
      expect(result.error?.oclif?.exit).toBe(1);
      expect(result.error?.message).toMatch(/Instance .* was not found in project .* in organization .*/);
    });

    it('errors when organization does not exist', async () => {
      accountsClientMock.getOrganization.mockRejectedValueOnce(new Error('not found'));
      const result = await runPullInstanceDirect();
      expect(result.error?.message).toContain(`Organization ${ORG_ID} was not found or is not accessible`);
    });

    it('errors when project does not exist in the organization', async () => {
      accountsClientMock.listProjects.mockResolvedValueOnce({ objects: [], total: 0 });
      const result = await runPullInstanceDirect();
      expect(result.error?.message).toContain(`Project ${PROJECT_ID} was not found in organization ${ORG_ID}`);
    });
  });
});
