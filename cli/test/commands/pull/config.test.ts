import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import PullConfigCommand from '../../../src/commands/pull/config.js';
import { root } from '../../helpers/root.js';

const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';

/** Minimal valid cloud config decodable by CLICloudConfig. */
const MOCK_CONFIG = { _type: 'cloud' as const, name: 'test-instance', region: 'us' };

const mockCloudClient = {
  deployInstance: vi.fn(),
  getInstanceConfig: vi.fn()
};

vi.mock('../../../src/clients/CloudClient.js', () => ({
  createCloudClient: () => mockCloudClient
}));

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\nregion: us\n`, 'utf8');
}

describe('pull config', () => {
  let oclifConfig: Config;
  let tmpDir: string;
  let origCwd: string;

  beforeAll(async () => {
    oclifConfig = await Config.load({ root });
  });

  function runPullConfigDirect(opts?: { directory?: string; instanceId?: string; orgId?: string; projectId?: string }) {
    const directory = opts?.directory ?? PROJECT_DIR;
    const args = ['--directory', directory];
    if (opts?.instanceId) args.push('--instance-id', opts.instanceId);
    if (opts?.orgId) args.push('--org-id', opts.orgId);
    if (opts?.projectId) args.push('--project-id', opts.projectId);
    const cmd = new PullConfigCommand(args, oclifConfig);
    return captureOutput(() => cmd.run());
  }

  beforeEach(() => {
    origCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'pull-config-test-'));
    process.chdir(tmpDir);
    mockCloudClient.getInstanceConfig.mockReset();
    mockCloudClient.getInstanceConfig.mockRejectedValue(new Error('network error'));
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('errors when directory does not exist and no link args', async () => {
    const result = await runCommand('pull config', { root });
    expect(result.error?.message).toContain(`Directory "${PROJECT_DIR}" not found`);
    expect(result.error?.message).toContain('--instance-id');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('when directory does not exist but link args given, creates directory and writes config', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    expect(existsSync(projectDir)).toBe(false);
    mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
    const result = await runPullConfigDirect({
      instanceId: 'inst-1',
      orgId: 'org-1',
      projectId: 'proj-1'
    });
    expect(result.error).toBeUndefined();
    expect(existsSync(projectDir)).toBe(true);
    expect(existsSync(join(projectDir, 'link.yaml'))).toBe(true);
    expect(existsSync(join(projectDir, SERVICE_FILENAME))).toBe(true);
    expect(readFileSync(join(projectDir, SERVICE_FILENAME), 'utf8')).toContain('_type: cloud');
    expect(result.stdout).toContain('Created');
    expect(result.stdout).toContain(`Wrote ${SERVICE_FILENAME}`);
  });

  it('errors when link.yaml does not exist and no link flags', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    const result = await runPullConfigDirect();
    expect(result.error?.message).toContain('Linking is required');
    expect(result.error?.message).toContain('--instance-id');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('when link does not exist but flags provided, creates link and writes service.yaml', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    // No service.yaml; ensureServiceTypeMatches allows missing when configFileRequired is false
    mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
    const result = await runPullConfigDirect({
      instanceId: 'inst-1',
      orgId: 'org-1',
      projectId: 'proj-1'
    });
    expect(result.error).toBeUndefined();
    expect(existsSync(join(projectDir, 'link.yaml'))).toBe(true);
    expect(readFileSync(join(projectDir, 'link.yaml'), 'utf8')).toContain('instance_id: inst-1');
    expect(result.stdout).toContain('Created');
    expect(result.stdout).toContain('link.yaml');
    expect(result.stdout).toContain(`Wrote ${SERVICE_FILENAME}`);
    expect(existsSync(join(projectDir, SERVICE_FILENAME))).toBe(true);
    expect(readFileSync(join(projectDir, SERVICE_FILENAME), 'utf8')).toContain('_type: cloud');
  });

  describe('when already linked', () => {
    beforeEach(async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      await runCommand('link cloud --instance-id=inst-1 --org-id=org-1 --project-id=proj-1', { root });
    });

    it('writes service.yaml when client succeeds', async () => {
      mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
      const result = await runPullConfigDirect();
      expect(result.error).toBeUndefined();
      const projectDir = join(tmpDir, PROJECT_DIR);
      expect(existsSync(join(projectDir, SERVICE_FILENAME))).toBe(true);
      expect(readFileSync(join(projectDir, SERVICE_FILENAME), 'utf8')).toContain('_type: cloud');
      expect(result.stdout).toContain(`Wrote ${SERVICE_FILENAME}`);
    });

    it('errors when client fails', async () => {
      const result = await runPullConfigDirect();
      expect(result.error?.oclif?.exit).toBe(1);
      expect(result.error?.message).toMatch(/Failed to fetch config/);
    });
  });
});
