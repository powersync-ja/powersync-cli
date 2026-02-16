import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import FetchConfigCommand from '../../../src/commands/fetch/config.js';
import { root } from '../../helpers/root.js';

const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';

/** Minimal valid cloud config decodable by ServiceCloudConfig. */
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

describe('fetch config', () => {
  let oclifConfig: Config;
  let tmpDir: string;
  let origCwd: string;

  beforeAll(async () => {
    oclifConfig = await Config.load({ root });
  });

  function runFetchConfigDirect(opts?: { directory?: string; output?: 'json' | 'yaml' }) {
    const directory = opts?.directory ?? PROJECT_DIR;
    const args = ['--directory', directory];
    if (opts?.output) args.push('--output', opts.output);
    const cmd = new FetchConfigCommand(args, oclifConfig);
    return captureOutput(() => cmd.run());
  }

  beforeEach(() => {
    origCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'fetch-config-test-'));
    process.chdir(tmpDir);
    mockCloudClient.getInstanceConfig.mockReset();
    mockCloudClient.getInstanceConfig.mockRejectedValue(new Error('network error'));
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('errors when directory does not exist', async () => {
    const result = await runCommand('fetch config', { root });
    expect(result.error?.message).toContain(`Directory "${PROJECT_DIR}" not found`);
    expect(result.error?.message).toContain('powersync init');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when cli.yaml does not exist', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    const result = await runCommand('fetch config', { root });
    expect(result.error?.message).toContain('Linking is required before using this command.');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  describe('with valid cloud project', () => {
    beforeEach(async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      await runCommand('link cloud --instance-id=inst-1 --org-id=org-1 --project-id=proj-1', {
        root
      });
    });

    it('errors with exit 1 when client fails', async () => {
      const result = await runFetchConfigDirect();
      expect(result.error?.oclif?.exit).toBe(1);
      expect(result.error?.message).toMatch(
        /Failed to fetch config for instance inst-1 in project proj-1 in org org-1/
      );
    });

    it('default output is yaml and prints fetched object (config + optional syncRules) to stdout', async () => {
      mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
      const result = await runFetchConfigDirect();
      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('config:');
      expect(result.stdout).toContain('_type: cloud');
      expect(result.stdout).toContain('region: us');
    });

    it('--output yaml prints fetched object as YAML to stdout', async () => {
      mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
      const result = await runFetchConfigDirect({ output: 'yaml' });
      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('config:');
      expect(result.stdout).toContain('_type: cloud');
      expect(result.stdout).toContain('region: us');
    });

    it('--output json prints fetched object (config, syncRules) as JSON to stdout', async () => {
      mockCloudClient.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
      const result = await runFetchConfigDirect({ output: 'json' });
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.stdout) as { config: typeof MOCK_CONFIG };
      expect(parsed.config).toEqual(MOCK_CONFIG);
    });

    it('--output json includes syncRules when returned', async () => {
      const syncRules = 'bucket_definitions: []\n';
      mockCloudClient.getInstanceConfig.mockResolvedValueOnce({
        config: MOCK_CONFIG,
        sync_rules: syncRules
      } as { config: typeof MOCK_CONFIG; sync_rules: string });
      const result = await runFetchConfigDirect({ output: 'json' });
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.stdout) as { config: typeof MOCK_CONFIG; syncRules?: string };
      expect(parsed.config).toEqual(MOCK_CONFIG);
      expect(parsed.syncRules).toBe(syncRules);
    });
  });
});
