import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import { CLI_FILENAME, env, SYNC_FILENAME } from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import DeploySyncConfig from '../../../src/commands/deploy/sync-config.js';
import { root } from '../../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../../setup.js';

const { instanceId: INSTANCE_ID, orgId: ORG_ID, projectId: PROJECT_ID } = MOCK_CLOUD_IDS;

const MOCK_CLOUD_CONFIG = {
  config: {
    region: 'us',
    replication: { connections: [{ name: 'default', type: 'postgresql', uri: 'postgres://user:pass@host/db' }] }
  },
  name: 'test-instance',
  sync_rules: ''
};

const SYNC_CONFIG_CONTENT = /* yaml */ `
bucket_definitions:
  global:
    data:
      - SELECT * FROM todos
`;

/** Run deploy:sync-config by instantiating the command directly so the managementClientMock spy applies. */
async function runSyncConfigDirect(args: string[] = []) {
  const config = await Config.load({ root });
  const cmd = new DeploySyncConfig(args, config);
  cmd.client = managementClientMock as unknown as DeploySyncConfig['client'];
  return captureOutput(() => cmd.run());
}

function makeProjectDir(tmpDir: string, subDir = 'powersync'): string {
  const projectDir = join(tmpDir, subDir);
  mkdirSync(projectDir, { recursive: true });
  return projectDir;
}

function writeLinkYaml(projectDir: string): void {
  const content = `type: cloud\ninstance_id: ${INSTANCE_ID}\norg_id: ${ORG_ID}\nproject_id: ${PROJECT_ID}\n`;
  writeFileSync(join(projectDir, CLI_FILENAME), content, 'utf8');
}

describe('deploy:sync-config', () => {
  let tmpDir: string;
  let origCwd: string;
  let origEnv: { INSTANCE_ID?: string; ORG_ID?: string; PROJECT_ID?: string; PS_ADMIN_TOKEN?: string };

  beforeEach(() => {
    resetManagementClientMocks();

    origCwd = process.cwd();
    origEnv = {
      INSTANCE_ID: env.INSTANCE_ID,
      ORG_ID: env.ORG_ID,
      PROJECT_ID: env.PROJECT_ID,
      PS_ADMIN_TOKEN: env.PS_ADMIN_TOKEN
    };

    tmpDir = mkdtempSync(join(tmpdir(), 'deploy-sync-config-test-'));
    process.chdir(tmpDir);
    env.PS_ADMIN_TOKEN = 'test-token';
    env.INSTANCE_ID = undefined;
    env.ORG_ID = undefined;
    env.PROJECT_ID = undefined;

    managementClientMock.getInstanceConfig.mockResolvedValue(MOCK_CLOUD_CONFIG);
    managementClientMock.getInstanceStatus.mockResolvedValue({ operations: [], provisioned: true });
    managementClientMock.validateSyncRules.mockResolvedValue({ errors: [] });
    // deployInstance fails by default so tests don't need a real endpoint
    managementClientMock.deployInstance.mockRejectedValue(new Error('mock deploy failure'));
  });

  afterEach(() => {
    process.chdir(origCwd);

    env.PS_ADMIN_TOKEN = origEnv.PS_ADMIN_TOKEN;
    env.INSTANCE_ID = origEnv.INSTANCE_ID;
    env.ORG_ID = origEnv.ORG_ID;
    env.PROJECT_ID = origEnv.PROJECT_ID;

    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  describe('succeeds without service.yaml present', () => {
    it('works with cli.yaml link file (no service.yaml)', async () => {
      const projectDir = makeProjectDir(tmpDir);
      // Intentionally no service.yaml written
      writeLinkYaml(projectDir);
      writeFileSync(join(projectDir, SYNC_FILENAME), SYNC_CONFIG_CONTENT, 'utf8');

      const result = await runSyncConfigDirect();

      // deployInstance is the last step; it failing means all prior validations passed
      expect(result.error?.message).toMatch(/mock deploy failure/);
    });

    it('works with --instance-id / --project-id / --org-id flags (no service.yaml, no cli.yaml)', async () => {
      const projectDir = makeProjectDir(tmpDir);
      // No service.yaml, no cli.yaml
      writeFileSync(join(projectDir, SYNC_FILENAME), SYNC_CONFIG_CONTENT, 'utf8');

      const result = await runSyncConfigDirect([
        '--instance-id',
        INSTANCE_ID,
        '--project-id',
        PROJECT_ID,
        '--org-id',
        ORG_ID
      ]);

      expect(result.error?.message).toMatch(/mock deploy failure/);
    });

    it('works with INSTANCE_ID / ORG_ID / PROJECT_ID env vars (no service.yaml, no cli.yaml)', async () => {
      const projectDir = makeProjectDir(tmpDir);
      // No service.yaml, no cli.yaml
      writeFileSync(join(projectDir, SYNC_FILENAME), SYNC_CONFIG_CONTENT, 'utf8');

      env.INSTANCE_ID = INSTANCE_ID;
      env.ORG_ID = ORG_ID;
      env.PROJECT_ID = PROJECT_ID;
      const result = await runSyncConfigDirect();

      expect(result.error?.message).toMatch(/mock deploy failure/);
    });
  });

  it('errors when linking info is absent entirely', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeFileSync(join(projectDir, SYNC_FILENAME), SYNC_CONFIG_CONTENT, 'utf8');

    const result = await runSyncConfigDirect();

    expect(result.error?.message).toMatch(/Linking is required/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when no existing cloud config is found', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeLinkYaml(projectDir);
    writeFileSync(join(projectDir, SYNC_FILENAME), SYNC_CONFIG_CONTENT, 'utf8');

    managementClientMock.getInstanceConfig.mockResolvedValue({ config: null, name: 'test-instance', sync_rules: '' });

    const result = await runSyncConfigDirect();

    expect(result.error?.message).toMatch(/No existing cloud config found/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when sync-config.yaml is missing', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeLinkYaml(projectDir);
    // No sync-config.yaml

    const result = await runSyncConfigDirect();

    expect(result.error?.message).toMatch(/Sync config content not loaded/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('reads sync config from --sync-config-file-path when provided (no default sync-config.yaml)', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeLinkYaml(projectDir);
    // No default sync-config.yaml; write the config at a custom path instead
    const customSyncConfigPath = join(tmpDir, 'my-custom-sync.yaml');
    writeFileSync(customSyncConfigPath, SYNC_CONFIG_CONTENT, 'utf8');

    const result = await runSyncConfigDirect(['--sync-config-file-path', customSyncConfigPath]);

    expect(result.error?.message).toMatch(/mock deploy failure/);
  });

  it('--sync-config-file-path takes precedence over default sync-config.yaml', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeLinkYaml(projectDir);
    // Write a different sync config at the default location
    writeFileSync(join(projectDir, SYNC_FILENAME), 'bucket_definitions: {}\n', 'utf8');
    // Write the expected content at the custom path
    const customSyncConfigPath = join(tmpDir, 'override-sync.yaml');
    writeFileSync(customSyncConfigPath, SYNC_CONFIG_CONTENT, 'utf8');

    managementClientMock.validateSyncRules.mockImplementation(({ sync_rules }) => {
      expect(sync_rules).toBe(SYNC_CONFIG_CONTENT);
      return Promise.resolve({ errors: [] });
    });

    const result = await runSyncConfigDirect(['--sync-config-file-path', customSyncConfigPath]);

    expect(result.error?.message).toMatch(/mock deploy failure/);
    expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
  });

  it('errors when --sync-config-file-path points to a non-existent file', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeLinkYaml(projectDir);

    const result = await runSyncConfigDirect(['--sync-config-file-path', '/nonexistent/path/sync.yaml']);

    expect(result.error?.message).toMatch(/nonexistent/);
  });

  it('validates sync config before deploying', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeLinkYaml(projectDir);
    writeFileSync(join(projectDir, SYNC_FILENAME), SYNC_CONFIG_CONTENT, 'utf8');

    const result = await runSyncConfigDirect();

    expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
    expect(managementClientMock.deployInstance).toHaveBeenCalled();
    expect(result.error?.message).toMatch(/mock deploy failure/);
  });

  it('skips sync config validation when --skip-sync-config-validation is passed', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeLinkYaml(projectDir);
    writeFileSync(join(projectDir, SYNC_FILENAME), SYNC_CONFIG_CONTENT, 'utf8');

    const result = await runSyncConfigDirect(['--skip-sync-config-validation']);

    expect(managementClientMock.validateSyncRules).not.toHaveBeenCalled();
    expect(managementClientMock.deployInstance).toHaveBeenCalled();
    expect(result.error?.message).toMatch(/mock deploy failure/);
  });
});
