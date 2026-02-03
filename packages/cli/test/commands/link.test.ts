import { runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { root } from '../helpers/root.js';

const LINK_FILENAME = 'link.yaml';
const PROJECT_DIR = 'powersync';

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

    it('errors when directory does not exist', async () => {
      const result = await runCommand('link cloud --instance-id=inst --org-id=org --project-id=proj', { root });
      expect(result.error?.message).toMatch(
        new RegExp(`Directory "${PROJECT_DIR}" not found. Run \`powersync init\` first to create the project.`)
      );
      expect(result.error?.oclif?.exit).toBe(1);
    });

    it('creates link.yaml with cloud config when directory exists', async () => {
      mkdirSync(join(tmpDir, PROJECT_DIR), { recursive: true });
      const { stdout } = await runCommand('link cloud --instance-id=inst-1 --org-id=org-1 --project-id=proj-1', {
        root
      });
      expect(stdout).toContain(`Updated ${PROJECT_DIR}/${LINK_FILENAME} with Cloud instance link.`);
      const linkPath = join(tmpDir, PROJECT_DIR, LINK_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe('inst-1');
      expect(linkYaml.org_id).toBe('org-1');
      expect(linkYaml.project_id).toBe('proj-1');
    });

    it('updates existing link.yaml and preserves comments', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      const linkPath = join(projectDir, LINK_FILENAME);
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
      const { stdout } = await runCommand(
        `link cloud --directory=${customDir} --instance-id=i --org-id=o --project-id=p`,
        { root }
      );
      expect(stdout).toContain(`Updated ${customDir}/${LINK_FILENAME}`);
      const linkYaml = parseYaml(readFileSync(join(tmpDir, customDir, LINK_FILENAME), 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe('i');
    });
  });

  describe('self-hosted', () => {
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

    it('errors when directory does not exist', async () => {
      const result = await runCommand('link self-hosted --url=https://ps.example.com --api-key=secret', { root });
      expect(result.error?.message).toMatch(
        new RegExp(`Directory "${PROJECT_DIR}" not found. Run \`powersync init\` first to create the project.`)
      );
      expect(result.error?.oclif?.exit).toBe(1);
    });

    it('creates link.yaml with self-hosted config when directory exists', async () => {
      mkdirSync(join(tmpDir, PROJECT_DIR), { recursive: true });
      const { stdout } = await runCommand('link self-hosted --url=https://sync.example.com --api-key=my-token', {
        root
      });
      expect(stdout).toContain(`Updated ${PROJECT_DIR}/${LINK_FILENAME} with self-hosted link.`);
      const linkPath = join(tmpDir, PROJECT_DIR, LINK_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://sync.example.com');
      expect(linkYaml.api_key).toBe('my-token');
    });

    it('updates existing link.yaml and preserves comments', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      const linkPath = join(projectDir, LINK_FILENAME);
      const withComments = `# Self-hosted config
type: self-hosted
`;
      writeFileSync(linkPath, withComments, 'utf8');
      await runCommand('link self-hosted --url=https://new.example.com --api-key=new-key', { root });
      const content = readFileSync(linkPath, 'utf8');
      expect(content).toContain('# Self-hosted config');
      const linkYaml = parseYaml(content);
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://new.example.com');
      expect(linkYaml.api_key).toBe('new-key');
    });

    it('respects --directory flag', async () => {
      const customDir = 'my-powersync';
      mkdirSync(join(tmpDir, customDir), { recursive: true });
      const { stdout } = await runCommand(
        `link self-hosted --directory=${customDir} --url=https://example.com --api-key=k`,
        {
          root
        }
      );
      expect(stdout).toContain(`Updated ${customDir}/${LINK_FILENAME}`);
      const linkYaml = parseYaml(readFileSync(join(tmpDir, customDir, LINK_FILENAME), 'utf8'));
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://example.com');
    });
  });
});
