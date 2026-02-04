import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { root } from '../helpers/root.js';

import * as CloudClient from '../../src/clients/CloudClient.js';
import * as DeployCommand from '../../src/commands/deploy.js';

const mockGetInstanceConfig = vi.fn();
const mockDeployInstance = vi.fn();
vi.spyOn(CloudClient, 'createCloudClient').mockReturnValue({
  deployInstance: mockDeployInstance,
  getInstanceConfig: mockGetInstanceConfig
} as unknown as ReturnType<typeof CloudClient.createCloudClient>);

/** Run deploy by instantiating the command and calling .run() so the spy on createCloudClient applies. */
async function runDeployDirect(opts?: { directory?: string }) {
  const directory = opts?.directory ?? PROJECT_DIR;
  const config = await Config.load({ root });
  const Deploy = DeployCommand.default;
  const cmd = new Deploy(['--directory', directory], config);
  return captureOutput(() => cmd.run());
}

const LINK_FILENAME = 'link.yaml';
const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\nregion: us\n`, 'utf8');
}

function writeLinkYaml(projectDir: string, opts: { instance_id: string; org_id: string; project_id: string }) {
  const content = `type: cloud\ninstance_id: ${opts.instance_id}\norg_id: ${opts.org_id}\nproject_id: ${opts.project_id}\n`;
  writeFileSync(join(projectDir, LINK_FILENAME), content, 'utf8');
}

describe('deploy', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    origCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'deploy-test-'));
    process.chdir(tmpDir);
    mockGetInstanceConfig.mockReset();
    mockDeployInstance.mockReset();
    mockGetInstanceConfig.mockRejectedValue(new Error('network error'));
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('errors when directory does not exist', async () => {
    const result = await runCommand('deploy', { root });
    expect(result.error?.message).toMatch(
      new RegExp(`Directory "${PROJECT_DIR}" not found. Run \`powersync init\` first to create the project.`)
    );
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

  it('errors when link.yaml does not exist', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    const result = await runCommand('deploy', { root });
    expect(result.error?.message).toContain('Linking is required before using this command.');
    expect(result.error?.message).toContain('powersync link cloud --instance-id=<id> --org-id=<id> --project-id=<id>');
    expect(result.error?.message).toContain('powersync link cloud --help');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when link.yaml is missing required fields', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    writeFileSync(join(projectDir, LINK_FILENAME), 'type: cloud\n', 'utf8');
    const result = await runCommand('deploy', { root });
    expect(result.error?.message).toMatch(/Failed to parse link\.yaml as CloudLinkConfig/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('respects --directory flag when project is in custom dir', async () => {
    const customDir = 'my-powersync';
    const projectDir = join(tmpDir, customDir);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    await runCommand(`link cloud --directory=${customDir} --instance-id=i --org-id=o --project-id=p`, { root });
    const result = await runCommand(`deploy --directory=${customDir}`, { root });
    expect(result.error?.oclif?.exit).toBe(1);
    expect(result.error?.message).toMatch(/instance i.*project p.*org o/);
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
      expect(result.error?.oclif?.exit).toBe(1);
      expect(result.error?.message).toMatch(
        /Failed to deploy changes to instance inst-1 in project proj-1 in org org-1/
      );
    });
  });
});
