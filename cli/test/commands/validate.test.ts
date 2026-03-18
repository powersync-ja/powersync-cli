import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import * as cliCore from '@powersync/cli-core';
import { CLI_FILENAME, env, SERVICE_FILENAME, SYNC_FILENAME } from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Validate from '../../src/commands/validate.js';
import { root } from '../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../setup.js';

const emptySyncValidation = {
  connections: [] as { name?: string }[],
  diagnostics: [] as cliCore.SyncDiagnostic[],
  errors: [] as { level: string; message: string }[]
};

type EnvSnapshot = {
  API_URL: string | undefined;
  INSTANCE_ID: string | undefined;
  ORG_ID: string | undefined;
  PROJECT_ID: string | undefined;
  PS_ADMIN_TOKEN: string | undefined;
};

describe('validate', () => {
  let tmpRoot: string;
  let origCwd: string;
  let origEnv: EnvSnapshot;

  beforeEach(() => {
    origCwd = process.cwd();
    origEnv = {
      API_URL: env.API_URL,
      INSTANCE_ID: env.INSTANCE_ID,
      ORG_ID: env.ORG_ID,
      PROJECT_ID: env.PROJECT_ID,
      PS_ADMIN_TOKEN: env.PS_ADMIN_TOKEN
    };
    tmpRoot = mkdtempSync(join(tmpdir(), 'validate-cmd-test-'));
    process.chdir(tmpRoot);
  });

  afterEach(() => {
    process.chdir(origCwd);
    env.API_URL = origEnv.API_URL;
    env.INSTANCE_ID = origEnv.INSTANCE_ID;
    env.ORG_ID = origEnv.ORG_ID;
    env.PROJECT_ID = origEnv.PROJECT_ID;
    env.PS_ADMIN_TOKEN = origEnv.PS_ADMIN_TOKEN;
    vi.restoreAllMocks();
    if (tmpRoot && existsSync(tmpRoot)) {
      rmSync(tmpRoot, { recursive: true });
    }
  });

  describe('self-hosted', () => {
    it('validates sync config from --sync-config-file-path, not default sync-config.yaml', async () => {
      const spy = vi.spyOn(cliCore, 'validateSelfHostedSyncRules').mockResolvedValue(emptySyncValidation as never);

      const projectDir = join(tmpRoot, 'powersync');
      mkdirSync(projectDir, { recursive: true });

      writeFileSync(
        join(projectDir, CLI_FILENAME),
        'type: self-hosted\napi_url: https://self-hosted.validate.test\napi_key: test-key\n',
        'utf8'
      );
      env.PS_ADMIN_TOKEN = 'test-key';

      writeFileSync(
        join(projectDir, SYNC_FILENAME),
        'bucket_definitions:\n  only_in_default_sync_config_yaml:\n    data: []\n',
        'utf8'
      );
      const customPath = join(tmpRoot, 'override-sync.yaml');
      writeFileSync(
        customPath,
        'bucket_definitions:\n  only_from_flag_path:\n    data:\n      - SELECT 1 FROM validate_custom_path_marker\n',
        'utf8'
      );

      const config = await Config.load({ root });
      const cmd = new Validate(
        [
          '--directory',
          'powersync',
          '--validate-only',
          'sync-config',
          '--sync-config-file-path',
          customPath,
          '--output',
          'json'
        ],
        config
      );

      const result = await captureOutput(() => cmd.run());
      expect(result.error).toBeUndefined();

      expect(spy).toHaveBeenCalledTimes(1);
      const call = spy.mock.calls[0]![0];
      expect(call.syncRulesContent).toContain('SELECT 1 FROM validate_custom_path_marker');
      expect(call.syncRulesContent).not.toContain('only_in_default_sync_config_yaml');
    });
  });

  describe('cloud', () => {
    it('validates sync config from --sync-config-file-path when linked as cloud', async () => {
      resetManagementClientMocks();
      const spy = vi.spyOn(cliCore, 'validateCloudSyncRules').mockResolvedValue(emptySyncValidation as never);

      const { instanceId, orgId, projectId } = MOCK_CLOUD_IDS;
      const projectDir = join(tmpRoot, 'powersync');
      mkdirSync(projectDir, { recursive: true });

      writeFileSync(
        join(projectDir, CLI_FILENAME),
        `type: cloud\ninstance_id: ${instanceId}\norg_id: ${orgId}\nproject_id: ${projectId}\n`,
        'utf8'
      );
      env.PS_ADMIN_TOKEN = 'token';
      env.INSTANCE_ID = undefined;
      env.ORG_ID = undefined;
      env.PROJECT_ID = undefined;

      managementClientMock.getInstanceConfig.mockResolvedValue({
        config: {
          region: 'us',
          replication: { connections: [{ name: 'default', type: 'postgresql', uri: 'postgres://x' }] }
        },
        id: instanceId,
        name: 'test-instance',
        sync_rules: ''
      });
      managementClientMock.getInstanceStatus.mockResolvedValue({ operations: [], provisioned: true });

      writeFileSync(
        join(projectDir, SERVICE_FILENAME),
        '_type: cloud\nname: test-instance\nregion: us\nreplication:\n  connections:\n    - name: default\n      type: postgresql\n      uri: postgres://x\n',
        'utf8'
      );
      writeFileSync(
        join(projectDir, SYNC_FILENAME),
        'bucket_definitions:\n  cloud_default_file_only:\n    data: []\n',
        'utf8'
      );
      const customPath = join(tmpRoot, 'cloud-custom-sync.yaml');
      writeFileSync(
        customPath,
        'bucket_definitions:\n  cloud_flag_path:\n    data:\n      - SELECT 1 FROM cloud_validate_override\n',
        'utf8'
      );

      const config = await Config.load({ root });
      const cmd = new Validate(
        [
          '--directory',
          'powersync',
          '--validate-only',
          'sync-config',
          '--sync-config-file-path',
          customPath,
          '--output',
          'json'
        ],
        config
      );

      const result = await captureOutput(() => cmd.run());
      expect(result.error).toBeUndefined();

      expect(spy).toHaveBeenCalledTimes(1);
      const call = spy.mock.calls[0]![0];
      expect(call.syncRulesContent).toContain('SELECT 1 FROM cloud_validate_override');
      expect(call.syncRulesContent).not.toContain('cloud_default_file_only');
    });
  });
});
