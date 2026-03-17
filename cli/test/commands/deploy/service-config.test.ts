import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import { CLI_FILENAME, env, SERVICE_FILENAME } from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import DeployServiceConfig from '../../../src/commands/deploy/service-config.js';
import { root } from '../../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../../setup.js';

const { instanceId: INSTANCE_ID, orgId: ORG_ID, projectId: PROJECT_ID } = MOCK_CLOUD_IDS;

const MOCK_CLOUD_CONFIG = {
  config: {
    region: 'us',
    replication: { connections: [{ name: 'default', type: 'postgresql', uri: 'postgres://user:pass@host/db' }] }
  },
  id: INSTANCE_ID,
  name: 'test-instance',
  sync_rules: /* yaml */ `
bucket_definitions:
  global:
    data:
      - SELECT * FROM todos
`
};

const SERVICE_YAML_CONTENT = /* yaml */ `
_type: cloud
name: test-instance
region: us
replication:
  connections:
    - name: default
      type: postgresql
      uri: postgres://user:pass@host/db
`;

/** Run deploy:service-config by instantiating the command directly so the managementClientMock spy applies. */
async function runServiceConfigDirect(args: string[] = []) {
  const config = await Config.load({ root });
  const cmd = new DeployServiceConfig(args, config);
  cmd.client = managementClientMock as unknown as DeployServiceConfig['client'];
  return captureOutput(() => cmd.run());
}

function makeProjectDir(tmpDir: string, subDir = 'powersync'): string {
  const projectDir = join(tmpDir, subDir);
  mkdirSync(projectDir, { recursive: true });
  return projectDir;
}

function writeServiceYaml(projectDir: string): void {
  writeFileSync(join(projectDir, SERVICE_FILENAME), SERVICE_YAML_CONTENT, 'utf8');
}

function writeLinkYaml(projectDir: string): void {
  const content = `type: cloud\ninstance_id: ${INSTANCE_ID}\norg_id: ${ORG_ID}\nproject_id: ${PROJECT_ID}\n`;
  writeFileSync(join(projectDir, CLI_FILENAME), content, 'utf8');
}

describe('deploy:service-config', () => {
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

    tmpDir = mkdtempSync(join(tmpdir(), 'deploy-service-config-test-'));
    process.chdir(tmpDir);
    env.PS_ADMIN_TOKEN = 'test-token';
    env.INSTANCE_ID = undefined;
    env.ORG_ID = undefined;
    env.PROJECT_ID = undefined;

    managementClientMock.getInstanceConfig.mockResolvedValue(MOCK_CLOUD_CONFIG);
    managementClientMock.getInstanceStatus.mockResolvedValue({ operations: [], provisioned: true });
    managementClientMock.testConnection.mockResolvedValue({
      configuration: { success: true },
      connection: { reachable: true, success: true },
      success: true
    });
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

  describe('succeeds without sync-config.yaml present', () => {
    it('works with cli.yaml link file (no sync-config.yaml)', async () => {
      const projectDir = makeProjectDir(tmpDir);
      writeServiceYaml(projectDir);
      writeLinkYaml(projectDir);
      // Intentionally no sync-config.yaml written

      const result = await runServiceConfigDirect();

      // deployInstance is the last step; it failing means all prior validations passed
      expect(result.error?.message).toMatch(/mock deploy failure/);
    });

    it('works with --instance-id / --project-id / --org-id flags (no sync-config.yaml)', async () => {
      const projectDir = makeProjectDir(tmpDir);
      writeServiceYaml(projectDir);
      // No cli.yaml, no sync-config.yaml

      const result = await runServiceConfigDirect([
        '--instance-id',
        INSTANCE_ID,
        '--project-id',
        PROJECT_ID,
        '--org-id',
        ORG_ID
      ]);

      expect(result.error?.message).toMatch(/mock deploy failure/);
    });

    it('works with INSTANCE_ID / ORG_ID / PROJECT_ID env vars (no sync-config.yaml)', async () => {
      const projectDir = makeProjectDir(tmpDir);
      writeServiceYaml(projectDir);
      // No cli.yaml, no sync-config.yaml

      env.INSTANCE_ID = INSTANCE_ID;
      env.ORG_ID = ORG_ID;
      env.PROJECT_ID = PROJECT_ID;

      const result = await runServiceConfigDirect();

      expect(result.error?.message).toMatch(/mock deploy failure/);
    });
  });

  describe('--skip-validations / --validate-only', () => {
    beforeEach(() => {
      const projectDir = makeProjectDir(tmpDir);
      writeServiceYaml(projectDir);
      writeLinkYaml(projectDir);
    });

    it('calls testConnection when no flags are passed', async () => {
      const result = await runServiceConfigDirect();
      expect(managementClientMock.testConnection).toHaveBeenCalled();
      expect(result.error?.message).toMatch(/mock deploy failure/);
    });

    it('does not call testConnection when --skip-validations=connections is passed', async () => {
      const result = await runServiceConfigDirect(['--skip-validations=connections']);
      expect(managementClientMock.testConnection).not.toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalled();
      expect(result.error?.message).toMatch(/mock deploy failure/);
    });

    it('does not call testConnection when --validate-only=configuration is passed', async () => {
      const result = await runServiceConfigDirect(['--validate-only=configuration']);
      expect(managementClientMock.testConnection).not.toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalled();
      expect(result.error?.message).toMatch(/mock deploy failure/);
    });

    it('calls testConnection when --validate-only=connections is passed', async () => {
      const result = await runServiceConfigDirect(['--validate-only=connections']);
      expect(managementClientMock.testConnection).toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalled();
      expect(result.error?.message).toMatch(/mock deploy failure/);
    });
  });

  it('errors when service.yaml is missing', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeLinkYaml(projectDir);
    // No service.yaml

    const result = await runServiceConfigDirect();

    expect(result.error?.message).toMatch(/service\.yaml/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when linking info is absent entirely', async () => {
    const projectDir = makeProjectDir(tmpDir);
    writeServiceYaml(projectDir);
    // No cli.yaml, no flags, no env vars

    const result = await runServiceConfigDirect();

    expect(result.error?.message).toMatch(/Linking is required/);
    expect(result.error?.oclif?.exit).toBe(1);
  });
});
