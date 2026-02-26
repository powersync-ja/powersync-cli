import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import FetchConfigCommand from '../../../src/commands/fetch/config.js';
import { root } from '../../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../../setup.js';

const PROJECT_DIR = 'powersync';
const CLI_FILENAME = 'cli.yaml';
const SERVICE_FILENAME = 'service.yaml';
const INSTANCE_ID = MOCK_CLOUD_IDS.instanceId;
const ORG_ID = MOCK_CLOUD_IDS.orgId;
const PROJECT_ID = MOCK_CLOUD_IDS.projectId;

/** Minimal valid cloud config decodable by ServiceCloudConfig. */
const MOCK_CONFIG = { _type: 'cloud' as const, name: 'test-instance', region: 'us' };

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\nregion: us\n`, 'utf8');
}

function writeLinkYaml(projectDir: string, opts: { instance_id: string; org_id: string; project_id: string }) {
  const content = `type: cloud\ninstance_id: ${opts.instance_id}\norg_id: ${opts.org_id}\nproject_id: ${opts.project_id}\n`;
  writeFileSync(join(projectDir, CLI_FILENAME), content, 'utf8');
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
    cmd.client = managementClientMock as unknown as FetchConfigCommand['client'];
    return captureOutput(() => cmd.run());
  }

  beforeEach(() => {
    resetManagementClientMocks();

    origCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'fetch-config-test-'));
    process.chdir(tmpDir);
    managementClientMock.getInstanceConfig.mockReset();
    managementClientMock.getInstanceConfig.mockRejectedValue(new Error('network error'));
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
      writeLinkYaml(projectDir, { instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID });
    });

    it('errors with exit 1 when client fails', async () => {
      const result = await runFetchConfigDirect();
      expect(result.error?.oclif?.exit).toBe(1);
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to fetch config for instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('default output is yaml and prints fetched object (config + optional syncRules) to stdout', async () => {
      managementClientMock.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
      const result = await runFetchConfigDirect();
      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('config:');
      expect(result.stdout).toContain('_type: cloud');
      expect(result.stdout).toContain('region: us');
    });

    it('--output yaml prints fetched object as YAML to stdout', async () => {
      managementClientMock.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
      const result = await runFetchConfigDirect({ output: 'yaml' });
      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('config:');
      expect(result.stdout).toContain('_type: cloud');
      expect(result.stdout).toContain('region: us');
    });

    it('--output json prints fetched object (config, syncRules) as JSON to stdout', async () => {
      managementClientMock.getInstanceConfig.mockResolvedValueOnce({ config: MOCK_CONFIG });
      const result = await runFetchConfigDirect({ output: 'json' });
      expect(result.error).toBeUndefined();
      const parsed = JSON.parse(result.stdout) as { config: typeof MOCK_CONFIG };
      expect(parsed.config).toEqual(MOCK_CONFIG);
    });

    it('--output json includes syncRules when returned', async () => {
      const syncRules = 'bucket_definitions: []\n';
      managementClientMock.getInstanceConfig.mockResolvedValueOnce({
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
