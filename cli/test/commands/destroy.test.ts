import { runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { root } from '../helpers/root.js';

const CLI_FILENAME = 'cli.yaml';
const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\nregion: us\n`, 'utf8');
}

function writeLinkYaml(projectDir: string, opts: { instance_id: string; org_id: string; project_id: string }) {
  const content = `type: cloud\ninstance_id: ${opts.instance_id}\norg_id: ${opts.org_id}\nproject_id: ${opts.project_id}\n`;
  writeFileSync(join(projectDir, CLI_FILENAME), content, 'utf8');
}

describe('destroy', () => {
  let tmpDir: string;
  let origCwd: string;
  let origPsToken: string | undefined;

  beforeEach(() => {
    origCwd = process.cwd();
    origPsToken = process.env.TOKEN;
    tmpDir = mkdtempSync(join(tmpdir(), 'destroy-test-'));
    process.chdir(tmpDir);
    process.env.TOKEN = 'test-token';
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (origPsToken === undefined) {delete process.env.TOKEN;}
    else {process.env.TOKEN = origPsToken;}

    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('errors when --confirm is not yes', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    await runCommand('link cloud --instance-id=i --org-id=o --project-id=p', { root });
    const result = await runCommand('destroy', { root });
    expect(result.error?.message).toContain('Destruction requires confirmation.');
    expect(result.error?.message).toContain('--confirm=yes');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when directory does not exist', async () => {
    const result = await runCommand('destroy --confirm=yes', { root });
    expect(result.error?.message).toMatch(/Directory "powersync" not found/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when service.yaml _type is self-hosted', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'self-hosted');
    writeLinkYaml(projectDir, { instance_id: 'i', org_id: 'o', project_id: 'p' });
    const result = await runCommand('destroy --confirm=yes', { root });
    expect(result.error?.message).toMatch(/has `_type: self-hosted` but this command requires `_type: cloud`/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when cli.yaml does not exist', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    const result = await runCommand('destroy --confirm=yes', { root });
    expect(result.error?.message).toContain('Linking is required');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when cli.yaml is missing required fields', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    writeFileSync(join(projectDir, CLI_FILENAME), 'type: cloud\n', 'utf8');
    const result = await runCommand('destroy --confirm=yes', { root });
    expect(result.error?.message).toMatch(/Failed to parse cli\.yaml as CloudCLIConfig/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('respects --directory flag when project is in custom dir', async () => {
    const customDir = 'my-powersync';
    const projectDir = join(tmpDir, customDir);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    await runCommand(`link cloud --directory=${customDir} --instance-id=i --org-id=o --project-id=p`, {
      root
    });
    const result = await runCommand(`destroy --directory=${customDir} --confirm=yes`, { root });
    expect(result.error).toBeDefined();
    // Fails with API error when token available, or keychain error when not
    expect(result.error?.message).toMatch(/instance i.*project p.*org o|Could not find password/);
  });

  describe('with valid cloud project', () => {
    beforeEach(async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      await runCommand('link cloud --instance-id=inst-1 --org-id=org-1 --project-id=proj-1', {
        root
      });
    });

    it('attempts destroy and errors with exit 1 when client fails', async () => {
      const result = await runCommand('destroy --confirm=yes', { root });
      expect(result.error).toBeDefined();
      // Fails with API error when token available, or keychain error when not
      expect(result.error?.message).toMatch(
        /Failed to destroy instance inst-1 in project proj-1 in org org-1|Could not find password/
      );
    });
  });
});
