import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import StopCommand from '../../src/commands/stop.js';
import { root } from '../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../setup.js';

const CLI_FILENAME = 'cli.yaml';
const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';
const INSTANCE_ID = MOCK_CLOUD_IDS.instanceId;
const ORG_ID = MOCK_CLOUD_IDS.orgId;
const PROJECT_ID = MOCK_CLOUD_IDS.projectId;

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\nregion: us\n`, 'utf8');
}

function writeLinkYaml(projectDir: string, opts: { instance_id: string; org_id: string; project_id: string }) {
  const content = `type: cloud\ninstance_id: ${opts.instance_id}\norg_id: ${opts.org_id}\nproject_id: ${opts.project_id}\n`;
  writeFileSync(join(projectDir, CLI_FILENAME), content, 'utf8');
}

describe('stop', () => {
  let oclifConfig: Config;
  let tmpDir: string;
  let origCwd: string;
  let origPsToken: string | undefined;

  beforeAll(async () => {
    oclifConfig = await Config.load({ root });
  });

  async function runStopDirect(args: string[]) {
    const cmd = new StopCommand(args, oclifConfig);
    cmd.client = managementClientMock as unknown as StopCommand['client'];
    return captureOutput(() => cmd.run());
  }

  beforeEach(() => {
    resetManagementClientMocks();

    origCwd = process.cwd();
    origPsToken = process.env.PS_ADMIN_TOKEN;
    tmpDir = mkdtempSync(join(tmpdir(), 'stop-test-'));
    process.chdir(tmpDir);
    process.env.PS_ADMIN_TOKEN = 'test-token';
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

  it('errors when --confirm is not yes', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    writeLinkYaml(projectDir, { instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID });
    const result = await runCommand('stop', { root });
    expect(result.error?.message).toContain('Stopping requires confirmation.');
    expect(result.error?.message).toContain('--confirm=yes');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when directory does not exist', async () => {
    const result = await runCommand('stop --confirm=yes', { root });
    expect(result.error?.message).toMatch(/Directory "powersync" not found/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when service.yaml _type is self-hosted', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'self-hosted');
    writeLinkYaml(projectDir, { instance_id: 'i', org_id: 'o', project_id: 'p' });
    const result = await runCommand('stop --confirm=yes', { root });
    expect(result.error?.message).toMatch(/has `_type: self-hosted` but this command requires `_type: cloud`/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when cli.yaml does not exist', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    const result = await runCommand('stop --confirm=yes', { root });
    expect(result.error?.message).toContain('Linking is required');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when cli.yaml is missing required fields', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    writeFileSync(join(projectDir, CLI_FILENAME), 'type: cloud\n', 'utf8');
    const result = await runCommand('stop --confirm=yes', { root });
    expect(result.error?.message).toContain('Linking is required before using this command.');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('respects --directory flag when project is in custom dir', async () => {
    const customDir = 'my-powersync';
    const projectDir = join(tmpDir, customDir);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    writeLinkYaml(projectDir, { instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID });
    const result = await runStopDirect([`--directory=${customDir}`, '--confirm=yes']);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toMatch(
      new RegExp(`Failed to stop instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
    );
  });

  describe('with valid cloud project', () => {
    beforeEach(async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      writeLinkYaml(projectDir, { instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID });
    });

    it('attempts stop and errors with exit 1 when client fails', async () => {
      const result = await runStopDirect(['--confirm=yes']);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to stop instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
    });
  });
});
