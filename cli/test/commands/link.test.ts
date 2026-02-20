import { runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { root } from '../helpers/root.js';

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(() => Promise.resolve('!env TOKEN')),
  password: vi.fn(() => Promise.resolve('test-token'))
}));

const CLI_FILENAME = 'cli.yaml';
const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\n`, 'utf8');
}

describe('link', () => {
  describe('cloud', () => {
    let tmpDir: string;
    let origCwd: string;

    beforeEach(() => {
      origCwd = process.cwd();
      tmpDir = mkdtempSync(join(tmpdir(), 'link-test-'));
      process.chdir(tmpDir);
    });

    afterEach(() => {
      process.chdir(origCwd);
      if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    });

    it('creates directory and cli.yaml when directory does not exist', async () => {
      const result = await runCommand('link cloud --instance-id=inst --org-id=org --project-id=proj', { root });
      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain(`Updated ${PROJECT_DIR}/${CLI_FILENAME} with Cloud instance link.`);
      const linkPath = join(tmpDir, PROJECT_DIR, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe('inst');
      expect(linkYaml.org_id).toBe('org');
      expect(linkYaml.project_id).toBe('proj');
    });

    it('errors when service.yaml _type does not match (self-hosted)', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'self-hosted');
      const result = await runCommand('link cloud --instance-id=inst --org-id=o --project-id=p', { root });
      expect(result.error?.message).toMatch(/has `_type: self-hosted` but this command requires `_type: cloud`/);
      expect(result.error?.oclif?.exit).toBe(1);
    });

    it('creates cli.yaml with cloud config when directory exists and service _type is cloud', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      const { stdout } = await runCommand('link cloud --instance-id=inst-1 --org-id=org-1 --project-id=proj-1', {
        root
      });
      expect(stdout).toContain(`Updated ${PROJECT_DIR}/${CLI_FILENAME} with Cloud instance link.`);
      const linkPath = join(tmpDir, PROJECT_DIR, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe('inst-1');
      expect(linkYaml.org_id).toBe('org-1');
      expect(linkYaml.project_id).toBe('proj-1');
    });

    it('updates existing cli.yaml and preserves comments', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      const linkPath = join(projectDir, CLI_FILENAME);
      const withComments = `# Managed by PowerSync CLI
# Run powersync link --help for info
type: cloud
`;
      writeFileSync(linkPath, withComments, 'utf8');
      await runCommand('link cloud --instance-id=new-inst --org-id=new-org --project-id=new-proj', { root });
      const content = readFileSync(linkPath, 'utf8');
      expect(content).toContain('# Managed by PowerSync CLI');
      expect(content).toContain('# Run powersync link --help for info');
      const linkYaml = parseYaml(content);
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe('new-inst');
      expect(linkYaml.org_id).toBe('new-org');
      expect(linkYaml.project_id).toBe('new-proj');
    });

    it('respects --directory flag', async () => {
      const customDir = 'my-powersync';
      mkdirSync(join(tmpDir, customDir), { recursive: true });
      writeServiceYaml(join(tmpDir, customDir), 'cloud');
      const { stdout } = await runCommand(
        `link cloud --directory=${customDir} --instance-id=i --org-id=o --project-id=p`,
        { root }
      );
      expect(stdout).toContain(`Updated ${customDir}/${CLI_FILENAME}`);
      const linkYaml = parseYaml(readFileSync(join(tmpDir, customDir, CLI_FILENAME), 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe('i');
    });
  });

  describe('self-hosted', () => {
    let tmpDir: string;
    let origCwd: string;
    let origPsToken: string | undefined;

    beforeEach(() => {
      origCwd = process.cwd();
      origPsToken = process.env.TOKEN;
      tmpDir = mkdtempSync(join(tmpdir(), 'link-test-'));
      process.chdir(tmpDir);
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
      process.env.TOKEN = 'secret';
      const result = await runCommand('link self-hosted --api-url=https://ps.example.com', { root });
      expect(result.error?.message).toContain(`Directory "${PROJECT_DIR}" not found`);
      expect(result.error?.message).toContain('powersync init');
      expect(result.error?.oclif?.exit).toBe(1);
    });

    it('errors when service.yaml _type does not match (cloud)', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      process.env.TOKEN = 'k';
      const result = await runCommand('link self-hosted --api-url=https://x.com', { root });
      expect(result.error?.message).toMatch(/has `_type: cloud` but this command requires `_type: self-hosted`/);
      expect(result.error?.oclif?.exit).toBe(1);
    });

    it.skip('creates cli.yaml with self-hosted config when directory exists and service _type is self-hosted', async () => {
      // Skipped: runCommand loads CLI from dist, so @inquirer/prompts mock is not applied and test hangs on input prompt
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'self-hosted');
      process.env.TOKEN = 'my-token';
      const { stdout } = await runCommand('link self-hosted --api-url=https://sync.example.com', { root });
      expect(stdout).toContain(`Updated ${PROJECT_DIR}/${CLI_FILENAME} with self-hosted link.`);
      const linkPath = join(tmpDir, PROJECT_DIR, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://sync.example.com');
      expect(linkYaml.api_key).toBe('!env TOKEN');
    });

    it.skip('updates existing cli.yaml and preserves comments', async () => {
      // Skipped: runCommand loads CLI from dist, so @inquirer/prompts mock is not applied and test hangs on input prompt
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'self-hosted');
      const linkPath = join(projectDir, CLI_FILENAME);
      const withComments = `# Self-hosted config
type: self-hosted
`;
      writeFileSync(linkPath, withComments, 'utf8');
      process.env.TOKEN = 'new-key';
      await runCommand('link self-hosted --api-url=https://new.example.com', { root });
      const content = readFileSync(linkPath, 'utf8');
      expect(content).toContain('# Self-hosted config');
      const linkYaml = parseYaml(content);
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://new.example.com');
      expect(linkYaml.api_key).toBe('!env TOKEN');
    });

    it.skip('respects --directory flag', async () => {
      // Skipped: runCommand loads CLI from dist, so @inquirer/prompts mock is not applied and test hangs on input prompt
      const customDir = 'my-powersync';
      mkdirSync(join(tmpDir, customDir), { recursive: true });
      writeServiceYaml(join(tmpDir, customDir), 'self-hosted');
      process.env.TOKEN = 'k';
      const { stdout } = await runCommand(`link self-hosted --directory=${customDir} --api-url=https://example.com`, {
        root
      });
      expect(stdout).toContain(`Updated ${customDir}/${CLI_FILENAME}`);
      const linkYaml = parseYaml(readFileSync(join(tmpDir, customDir, CLI_FILENAME), 'utf8'));
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://example.com');
    });
  });
});
