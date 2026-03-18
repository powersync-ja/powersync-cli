import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import { CLI_FILENAME, env, SERVICE_FILENAME, SYNC_FILENAME } from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Validate from '../../src/commands/validate.js';
import { root } from '../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_CONFIG, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../setup.js';

const { instanceId: INSTANCE_ID, orgId: ORG_ID, projectId: PROJECT_ID } = MOCK_CLOUD_IDS;

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

const SYNC_CONFIG_CONTENT = /* yaml */ `
bucket_definitions:
  global:
    data:
      - SELECT * FROM todos
`;

async function runValidateDirect(args: string[] = []) {
  const config = await Config.load({ root });
  const cmd = new Validate(args, config);
  return captureOutput(() => cmd.run());
}

describe('validate', () => {
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

    tmpDir = mkdtempSync(join(tmpdir(), 'validate-test-'));
    process.chdir(tmpDir);
    env.PS_ADMIN_TOKEN = 'test-token';
    env.INSTANCE_ID = undefined;
    env.ORG_ID = undefined;
    env.PROJECT_ID = undefined;

    const projectDir = join(tmpDir, 'powersync');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, SERVICE_FILENAME), SERVICE_YAML_CONTENT, 'utf8');
    writeFileSync(join(projectDir, SYNC_FILENAME), SYNC_CONFIG_CONTENT, 'utf8');
    writeFileSync(
      join(projectDir, CLI_FILENAME),
      `type: cloud\ninstance_id: ${INSTANCE_ID}\norg_id: ${ORG_ID}\nproject_id: ${PROJECT_ID}\n`,
      'utf8'
    );

    // All validations succeed by default
    managementClientMock.getInstanceConfig.mockResolvedValue(MOCK_CLOUD_CONFIG);
    managementClientMock.getInstanceStatus.mockResolvedValue({ operations: [], provisioned: true });
    managementClientMock.validateSyncRules.mockResolvedValue({ errors: [] });
    managementClientMock.testConnection.mockResolvedValue({
      configuration: { success: true },
      connection: { reachable: true, success: true },
      success: true
    });
  });

  afterEach(() => {
    process.chdir(origCwd);

    env.PS_ADMIN_TOKEN = origEnv.PS_ADMIN_TOKEN;
    env.INSTANCE_ID = origEnv.INSTANCE_ID;
    env.ORG_ID = origEnv.ORG_ID;
    env.PROJECT_ID = origEnv.PROJECT_ID;

    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  describe('--skip-validations', () => {
    it('calls testConnection and validateSyncRules when no flags are passed', async () => {
      await runValidateDirect();
      expect(managementClientMock.testConnection).toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
    });

    it('does not call testConnection when --skip-validations=connections', async () => {
      await runValidateDirect(['--skip-validations=connections']);
      expect(managementClientMock.testConnection).not.toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
    });

    it('does not call validateSyncRules when --skip-validations=sync-config', async () => {
      await runValidateDirect(['--skip-validations=sync-config']);
      expect(managementClientMock.testConnection).toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).not.toHaveBeenCalled();
    });

    it('skips both connections and sync-config when passed as a comma-separated list', async () => {
      await runValidateDirect(['--skip-validations=connections,sync-config']);
      expect(managementClientMock.testConnection).not.toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).not.toHaveBeenCalled();
    });
  });

  describe('--validate-only', () => {
    it('calls only validateSyncRules when --validate-only=sync-config', async () => {
      await runValidateDirect(['--validate-only=sync-config']);
      expect(managementClientMock.testConnection).not.toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
    });

    it('calls only testConnection when --validate-only=connections', async () => {
      await runValidateDirect(['--validate-only=connections']);
      expect(managementClientMock.testConnection).toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).not.toHaveBeenCalled();
    });

    it('calls neither testConnection nor validateSyncRules when --validate-only=configuration', async () => {
      await runValidateDirect(['--validate-only=configuration']);
      expect(managementClientMock.testConnection).not.toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).not.toHaveBeenCalled();
    });
  });
});
