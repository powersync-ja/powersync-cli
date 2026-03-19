import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import { CLI_FILENAME, SERVICE_FILENAME, SYNC_FILENAME } from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';

import DeployCommand from '../../src/commands/deploy/index.js';
import { root } from '../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../setup.js';

/** Run deploy by instantiating the command and calling .run() so the spy on createCloudClient applies. */
async function runDeployDirect(opts?: { args?: string[]; directory?: string }) {
  const directory = opts?.directory ?? PROJECT_DIR;
  const config = await Config.load({ root });
  const cmd = new DeployCommand(['--directory', directory, ...(opts?.args ?? [])], config);
  cmd.client = managementClientMock as unknown as DeployCommand['client'];
  return captureOutput(() => cmd.run());
}

const PROJECT_DIR = 'powersync';
const INSTANCE_ID = MOCK_CLOUD_IDS.instanceId;
const ORG_ID = MOCK_CLOUD_IDS.orgId;
const PROJECT_ID = MOCK_CLOUD_IDS.projectId;

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  const content =
    type === 'cloud'
      ? '_type: cloud\nname: test-instance\nregion: us\nreplication:\n  connections:\n    - name: default\n      type: postgresql\n      uri: postgres://user:pass@host/db\n'
      : `_type: ${type}\nregion: us\n`;
  writeFileSync(join(projectDir, SERVICE_FILENAME), content, 'utf8');
}

function writeCloudServiceYaml(projectDir: string, config: Record<string, unknown>) {
  writeFileSync(join(projectDir, SERVICE_FILENAME), stringify(config), 'utf8');
}

function writeLinkYaml(projectDir: string, opts: { instance_id: string; org_id: string; project_id: string }) {
  const content = `type: cloud\ninstance_id: ${opts.instance_id}\norg_id: ${opts.org_id}\nproject_id: ${opts.project_id}\n`;
  writeFileSync(join(projectDir, CLI_FILENAME), content, 'utf8');
}

function writeSyncConfigYaml(projectDir: string) {
  writeFileSync(join(projectDir, SYNC_FILENAME), 'bucket_definitions:\n  global:\n    include: true\n', 'utf8');
}

describe('deploy', () => {
  let tmpDir: string;
  let origCwd: string;
  let origPsToken: string | undefined;

  beforeEach(() => {
    resetManagementClientMocks();

    origCwd = process.cwd();
    origPsToken = process.env.PS_ADMIN_TOKEN;
    tmpDir = mkdtempSync(join(tmpdir(), 'deploy-test-'));
    process.chdir(tmpDir);
    process.env.PS_ADMIN_TOKEN = 'test-token';
    managementClientMock.getInstanceConfig.mockResolvedValue({
      config: { region: 'us', replication: { connections: [{ name: 'default', type: 'postgresql' }] } },
      id: INSTANCE_ID,
      name: 'test-instance',
      sync_rules: ''
    });
    managementClientMock.getInstanceStatus.mockResolvedValue({ operations: [], provisioned: true });
    managementClientMock.deployInstance.mockRejectedValue(new Error('network error'));
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (origPsToken === undefined) {
      delete process.env.PS_ADMIN_TOKEN;
    } else {
      process.env.PS_ADMIN_TOKEN = origPsToken;
    }

    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('errors when directory does not exist', async () => {
    const result = await runCommand('deploy', { root });
    expect(result.error?.message).toContain(`Directory "${PROJECT_DIR}" not found`);
    expect(result.error?.message).toContain('powersync init');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when service.yaml _type is self-hosted', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'self-hosted');
    writeLinkYaml(projectDir, { instance_id: 'i', org_id: 'o', project_id: 'p' });
    const result = await runCommand('deploy', { root });
    expect(result.error?.message).toMatch(/has `_type: self-hosted` but this command requires `_type: cloud`/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when cli.yaml does not exist', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    const result = await runCommand('deploy', { root });
    expect(result.error?.message).toContain('Linking is required');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when cli.yaml is missing required fields', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    writeFileSync(join(projectDir, CLI_FILENAME), 'type: cloud\n', 'utf8');
    const result = await runCommand('deploy', { root });
    expect(result.error?.message).toContain('Linking is required before using this command.');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('respects --directory flag when project is in custom dir', async () => {
    const customDir = 'my-powersync';
    const projectDir = join(tmpDir, customDir);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    writeLinkYaml(projectDir, { instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID });
    const result = await runCommand(`deploy --directory=${customDir}`, { root });
    expect(result.error).toBeDefined();
    expect(result.error?.message).toMatch(new RegExp(`instance ${INSTANCE_ID}.*project ${PROJECT_ID}.*org ${ORG_ID}`));
  });

  describe('with valid cloud project', () => {
    beforeEach(async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      writeSyncConfigYaml(projectDir);
      writeLinkYaml(projectDir, { instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID });
    });

    it('attempts deploy and errors with exit 1 when client fails', async () => {
      const result = await runDeployDirect();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('validates sync config before deploying', async () => {
      const result = await runDeployDirect();
      expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalled();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('fails before deploy when attempting to change the instance region', async () => {
      managementClientMock.getInstanceConfig.mockResolvedValue({
        config: { region: 'eu', replication: { connections: [{ name: 'default', type: 'postgresql' }] } },
        id: INSTANCE_ID,
        name: 'test-instance',
        sync_rules: ''
      });

      const result = await runDeployDirect();

      expect(managementClientMock.deployInstance).not.toHaveBeenCalled();
      expect(result.error?.message).toBe('Validation tests failed. Fix the issues and try deploying again.');
      expect(result.stdout).toContain('The region cannot be changed after initial deployment.');
      expect(result.stdout).toContain('Existing region: eu. Configured region: us.');
    });

    it('skips sync config validation when --skip-validations=sync-config is passed', async () => {
      const result = await runDeployDirect({ args: ['--skip-validations=sync-config'] });
      expect(managementClientMock.validateSyncRules).not.toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalled();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('deploys with additional config properties when configuration validation is skipped', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      const extraConnectionConfig = {
        max_parameter_query_results: 123,
        parallelism: {
          fetch: 4
        }
      };
      writeCloudServiceYaml(projectDir, {
        _type: 'cloud',
        name: 'test-instance',
        region: 'us',
        replication: {
          connections: [
            {
              config: extraConnectionConfig,
              name: 'default',
              type: 'postgresql',
              uri: 'postgres://user:pass@host/db'
            }
          ]
        }
      });

      const result = await runDeployDirect({ args: ['--skip-validations=configuration'] });

      expect(managementClientMock.testConnection).toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          app_id: PROJECT_ID,
          config: expect.objectContaining({
            region: 'us',
            replication: {
              connections: [
                {
                  config: extraConnectionConfig,
                  name: 'default',
                  type: 'postgresql',
                  uri: 'postgres://user:pass@host/db'
                }
              ]
            }
          }),
          id: INSTANCE_ID,
          name: 'test-instance',
          org_id: ORG_ID,
          sync_rules: 'bucket_definitions:\n  global:\n    include: true\n'
        })
      );
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('calls testConnection when validating connections before deploying', async () => {
      const result = await runDeployDirect();
      expect(managementClientMock.testConnection).toHaveBeenCalled();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('does not call testConnection when --skip-validations=connections is passed', async () => {
      const result = await runDeployDirect({ args: ['--skip-validations=connections'] });
      expect(managementClientMock.testConnection).not.toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalled();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('does not call testConnection when --validate-only=sync-config is passed', async () => {
      const result = await runDeployDirect({ args: ['--validate-only=sync-config'] });
      expect(managementClientMock.testConnection).not.toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalled();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('does not call validateSyncRules when --validate-only=connections is passed', async () => {
      const result = await runDeployDirect({ args: ['--validate-only=connections'] });
      expect(managementClientMock.testConnection).toHaveBeenCalled();
      expect(managementClientMock.validateSyncRules).not.toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalled();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });

    it('uses sync rules from --sync-config-file-path instead of sync-config.yaml', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      const fromDefaultFile = 'bucket_definitions:\n  only_in_sync_config_yaml: true\n';
      const fromCustomPath = 'bucket_definitions:\n  only_in_custom_path: true\n';
      writeFileSync(join(projectDir, SYNC_FILENAME), fromDefaultFile, 'utf8');
      const customPath = join(tmpDir, 'other-sync.yaml');
      writeFileSync(customPath, fromCustomPath, 'utf8');

      managementClientMock.validateSyncRules.mockImplementation(({ sync_rules }) => {
        expect(sync_rules).toBe(fromCustomPath);
        expect(sync_rules).not.toContain('only_in_sync_config_yaml');
        return Promise.resolve({ errors: [] });
      });

      const result = await runDeployDirect({
        args: ['--sync-config-file-path', customPath]
      });

      expect(managementClientMock.validateSyncRules).toHaveBeenCalled();
      expect(managementClientMock.deployInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          sync_rules: fromCustomPath
        })
      );
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to .* instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });
  });
});
