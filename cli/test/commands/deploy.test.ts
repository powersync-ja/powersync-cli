import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import { CLI_FILENAME, SERVICE_FILENAME } from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import DeployCommand from '../../src/commands/deploy/index.js';
import { root } from '../helpers/root.js';
import { managementClientMock, resetManagementClientMocks } from '../setup.js';

/** Run deploy by instantiating the command and calling .run() so the spy on createCloudClient applies. */
async function runDeployDirect(opts?: { directory?: string }) {
  const directory = opts?.directory ?? PROJECT_DIR;
  const config = await Config.load({ root });
  const cmd = new DeployCommand(['--directory', directory], config);
  cmd.client = managementClientMock as unknown as DeployCommand['client'];
  return captureOutput(() => cmd.run());
}

const PROJECT_DIR = 'powersync';

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  const content =
    type === 'cloud'
      ? '_type: cloud\nname: test-instance\nregion: us\nreplication:\n  connections:\n    - name: default\n      type: postgresql\n      uri: postgres://user:pass@host/db\n'
      : `_type: ${type}\nregion: us\n`;
  writeFileSync(join(projectDir, SERVICE_FILENAME), content, 'utf8');
}

function writeLinkYaml(projectDir: string, opts: { instance_id: string; org_id: string; project_id: string }) {
  const content = `type: cloud\ninstance_id: ${opts.instance_id}\norg_id: ${opts.org_id}\nproject_id: ${opts.project_id}\n`;
  writeFileSync(join(projectDir, CLI_FILENAME), content, 'utf8');
}

describe('deploy', () => {
  let tmpDir: string;
  let origCwd: string;
  let origPsToken: string | undefined;

  beforeEach(() => {
    resetManagementClientMocks();

    origCwd = process.cwd();
    origPsToken = process.env.TOKEN;
    tmpDir = mkdtempSync(join(tmpdir(), 'deploy-test-'));
    process.chdir(tmpDir);
    process.env.TOKEN = 'test-token';
    managementClientMock.getInstanceConfig.mockResolvedValue({
      config: { region: 'us', replication: { connections: [{ name: 'default', type: 'postgresql' }] } },
      name: 'test-instance',
      sync_rules: ''
    });
    managementClientMock.getInstanceStatus.mockResolvedValue({ operations: [], provisioned: true });
    managementClientMock.deployInstance.mockRejectedValue(new Error('network error'));
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (origPsToken === undefined) {
      delete process.env.TOKEN;
    } else {
      process.env.TOKEN = origPsToken;
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
    await runCommand(`link cloud --directory=${customDir} --instance-id=i --org-id=o --project-id=p`, { root });
    const result = await runCommand(`deploy --directory=${customDir}`, { root });
    expect(result.error).toBeDefined();
    // Fails with API error when token available, or keychain error when not
    expect(result.error?.message).toMatch(/instance i.*project p.*org o|Could not find password/);
  });

  describe('with valid cloud project', () => {
    beforeEach(async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      await runCommand('link cloud --instance-id=inst-1 --org-id=org-1 --project-id=proj-1', { root });
    });

    it('attempts deploy and errors with exit 1 when client fails', async () => {
      const result = await runDeployDirect();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toMatch(/Failed to .* instance inst-1 in project proj-1 in org org-1/);
    });
  });
});
