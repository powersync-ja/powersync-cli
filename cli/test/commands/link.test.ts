import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import * as cliCore from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import LinkCloud from '../../src/commands/link/cloud.js';
import LinkSelfHosted from '../../src/commands/link/self-hosted.js';
import { root } from '../helpers/root.js';
import { managementClientMock, resetManagementClientMocks } from '../setup.js';

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(() => Promise.resolve('!env PS_ADMIN_TOKEN')),
  password: vi.fn(() => Promise.resolve('test-token'))
}));

const CLI_FILENAME = 'cli.yaml';
const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';
const ORG_ID = '64b3f8e1a2c4d5e6f7080912';
const PROJECT_ID = '68978b01db7a810006d795f2';
const INSTANCE_ID = '690cf75c96a2ff4fd98b160a';

const accountsClientMock = {
  getOrganization: vi.fn(),
  listProjects: vi.fn()
};

vi.spyOn(cliCore, 'createAccountsHubClient').mockImplementation(
  () => accountsClientMock as unknown as ReturnType<typeof cliCore.createAccountsHubClient>
);

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\n`, 'utf8');
}

function writeValidCloudServiceYaml(projectDir: string) {
  const content = `_type: cloud
name: test-instance
region: us
replication:
  connections:
    - name: default
      type: postgresql
      uri: postgres://user:pass@host/db
`;
  writeFileSync(join(projectDir, SERVICE_FILENAME), content, 'utf8');
}

async function runLinkCloudDirect(args: string[]) {
  const config = await Config.load({ root });
  const cmd = new LinkCloud(args, config);
  cmd.client = managementClientMock as unknown as LinkCloud['client'];
  return captureOutput(() => cmd.run());
}

async function runLinkSelfHostedDirect(args: string[]) {
  const config = await Config.load({ root });
  const cmd = new LinkSelfHosted(args, config);
  return captureOutput(() => cmd.run());
}

describe('link', () => {
  describe('cloud', () => {
    let tmpDir: string;
    let origCwd: string;

    beforeEach(() => {
      resetManagementClientMocks();
      accountsClientMock.getOrganization.mockResolvedValue({ id: ORG_ID, label: 'Test Org' });
      accountsClientMock.listProjects.mockResolvedValue({
        objects: [{ id: PROJECT_ID, name: 'Test Project' }],
        total: 1
      });
      managementClientMock.getInstanceConfig.mockResolvedValue({});
      origCwd = process.cwd();
      tmpDir = mkdtempSync(join(tmpdir(), 'link-test-'));
      process.chdir(tmpDir);
    });

    afterEach(() => {
      process.chdir(origCwd);
      if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
    });

    it('creates directory and cli.yaml when directory does not exist', async () => {
      const { error } = await runLinkCloudDirect([
        `--instance-id=${INSTANCE_ID}`,
        `--org-id=${ORG_ID}`,
        `--project-id=${PROJECT_ID}`
      ]);
      expect(error).toBeUndefined();
      const linkPath = join(tmpDir, PROJECT_DIR, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe(INSTANCE_ID);
      expect(linkYaml.org_id).toBe(ORG_ID);
      expect(linkYaml.project_id).toBe(PROJECT_ID);
    });

    it('creates custom directory and cli.yaml when custom directory does not exist', async () => {
      const customDir = 'custom-powersync';
      const { error } = await runLinkCloudDirect([
        `--directory=${customDir}`,
        `--instance-id=${INSTANCE_ID}`,
        `--org-id=${ORG_ID}`,
        `--project-id=${PROJECT_ID}`
      ]);
      expect(error).toBeUndefined();
      const linkPath = join(tmpDir, customDir, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe(INSTANCE_ID);
      expect(linkYaml.org_id).toBe(ORG_ID);
      expect(linkYaml.project_id).toBe(PROJECT_ID);
    });

    it('errors when service.yaml _type does not match (self-hosted)', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'self-hosted');
      const { error } = await runLinkCloudDirect([
        `--instance-id=${INSTANCE_ID}`,
        `--org-id=${ORG_ID}`,
        `--project-id=${PROJECT_ID}`
      ]);
      expect(error?.message).toMatch(/has `_type: self-hosted` but this command requires `_type: cloud`/);
    });

    it('creates cli.yaml with cloud config when directory exists and service _type is cloud', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      const { stdout } = await runLinkCloudDirect([
        `--instance-id=${INSTANCE_ID}`,
        `--org-id=${ORG_ID}`,
        `--project-id=${PROJECT_ID}`
      ]);
      expect(stdout).toContain(`Updated ${PROJECT_DIR}/${CLI_FILENAME} with Cloud instance link.`);
      const linkPath = join(tmpDir, PROJECT_DIR, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe(INSTANCE_ID);
      expect(linkYaml.org_id).toBe(ORG_ID);
      expect(linkYaml.project_id).toBe(PROJECT_ID);
    });

    it('creates and links cloud instance when directory exists and --create is used', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeValidCloudServiceYaml(projectDir);
      managementClientMock.listRegions.mockResolvedValueOnce({ regions: [{ name: 'us' }] });
      managementClientMock.createInstance.mockResolvedValueOnce({ id: INSTANCE_ID });

      const { error, stdout } = await runLinkCloudDirect([
        '--create',
        `--org-id=${ORG_ID}`,
        `--project-id=${PROJECT_ID}`
      ]);

      expect(error).toBeUndefined();
      expect(stdout).toContain(`Created Cloud instance ${INSTANCE_ID} and updated ${PROJECT_DIR}/${CLI_FILENAME}.`);

      const linkPath = join(tmpDir, PROJECT_DIR, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe(INSTANCE_ID);
      expect(linkYaml.org_id).toBe(ORG_ID);
      expect(linkYaml.project_id).toBe(PROJECT_ID);
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
      await runLinkCloudDirect([`--instance-id=${INSTANCE_ID}`, `--org-id=${ORG_ID}`, `--project-id=${PROJECT_ID}`]);
      const content = readFileSync(linkPath, 'utf8');
      expect(content).toContain('# Managed by PowerSync CLI');
      expect(content).toContain('# Run powersync link --help for info');
      const linkYaml = parseYaml(content);
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe(INSTANCE_ID);
      expect(linkYaml.org_id).toBe(ORG_ID);
      expect(linkYaml.project_id).toBe(PROJECT_ID);
    });

    it('respects --directory flag', async () => {
      const customDir = 'my-powersync';
      mkdirSync(join(tmpDir, customDir), { recursive: true });
      writeServiceYaml(join(tmpDir, customDir), 'cloud');
      const { stdout } = await runLinkCloudDirect([
        `--directory=${customDir}`,
        `--instance-id=${INSTANCE_ID}`,
        `--org-id=${ORG_ID}`,
        `--project-id=${PROJECT_ID}`
      ]);
      expect(stdout).toContain(`Updated ${customDir}/${CLI_FILENAME}`);
      const linkYaml = parseYaml(readFileSync(join(tmpDir, customDir, CLI_FILENAME), 'utf8'));
      expect(linkYaml.type).toBe('cloud');
      expect(linkYaml.instance_id).toBe(INSTANCE_ID);
    });

    it('errors for invalid ObjectID flag values', async () => {
      const { error } = await runLinkCloudDirect([
        `--instance-id=${INSTANCE_ID}`,
        `--org-id=${ORG_ID}`,
        '--project-id=invalid/project-id'
      ]);
      expect(error?.message).toContain('Invalid --project-id');
    });

    it('errors when project does not exist in the organization', async () => {
      accountsClientMock.listProjects.mockResolvedValueOnce({ objects: [], total: 0 });

      const { error } = await runLinkCloudDirect([
        `--instance-id=${INSTANCE_ID}`,
        `--org-id=${ORG_ID}`,
        `--project-id=${PROJECT_ID}`
      ]);

      expect(error?.message).toContain(`Project ${PROJECT_ID} was not found in organization ${ORG_ID}`);
      expect(error?.message).not.toContain(', ::');
    });

    it('errors when instance does not exist and --create is not used', async () => {
      managementClientMock.getInstanceConfig.mockRejectedValueOnce(new Error('not found'));

      const { error } = await runLinkCloudDirect([
        `--instance-id=${INSTANCE_ID}`,
        `--org-id=${ORG_ID}`,
        `--project-id=${PROJECT_ID}`
      ]);

      expect(error?.message).toContain(
        `Instance ${INSTANCE_ID} was not found in project ${PROJECT_ID} in organization ${ORG_ID}`
      );
    });
  });

  describe('self-hosted', () => {
    let tmpDir: string;
    let origCwd: string;
    let origPsToken: string | undefined;

    beforeEach(() => {
      origCwd = process.cwd();
      origPsToken = process.env.PS_ADMIN_TOKEN;
      tmpDir = mkdtempSync(join(tmpdir(), 'link-test-'));
      process.chdir(tmpDir);
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

    it('creates directory and cli.yaml when directory does not exist', async () => {
      process.env.PS_ADMIN_TOKEN = 'secret';
      const result = await runCommand('link self-hosted --api-url=https://ps.example.com', { root });
      expect(result.error).toBeUndefined();
      const linkPath = join(tmpDir, PROJECT_DIR, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://ps.example.com');
      expect(linkYaml.api_key).toBe('!env PS_ADMIN_TOKEN');
    });

    it('errors when service.yaml _type does not match (cloud)', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      process.env.PS_ADMIN_TOKEN = 'k';
      const result = await runCommand('link self-hosted --api-url=https://x.com', { root });
      expect(result.error?.message).toMatch(/has `_type: cloud` but this command requires `_type: self-hosted`/);
      expect(result.error?.oclif?.exit).toBe(1);
    });

    it('creates cli.yaml with self-hosted config when directory exists and service _type is self-hosted', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'self-hosted');
      process.env.PS_ADMIN_TOKEN = 'my-token';
      const { stdout } = await runLinkSelfHostedDirect(['--api-url=https://sync.example.com']);
      expect(stdout).toContain(`Updated ${PROJECT_DIR}/${CLI_FILENAME} with self-hosted link.`);
      const linkPath = join(tmpDir, PROJECT_DIR, CLI_FILENAME);
      expect(existsSync(linkPath)).toBe(true);
      const linkYaml = parseYaml(readFileSync(linkPath, 'utf8'));
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://sync.example.com');
      expect(linkYaml.api_key).toBe('!env PS_ADMIN_TOKEN');
    });

    it('updates existing cli.yaml and preserves comments', async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'self-hosted');
      const linkPath = join(projectDir, CLI_FILENAME);
      const withComments = `# Self-hosted config
type: self-hosted
`;
      writeFileSync(linkPath, withComments, 'utf8');
      process.env.PS_ADMIN_TOKEN = 'new-key';
      await runLinkSelfHostedDirect(['--api-url=https://new.example.com']);
      const content = readFileSync(linkPath, 'utf8');
      expect(content).toContain('# Self-hosted config');
      const linkYaml = parseYaml(content);
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://new.example.com');
      expect(linkYaml.api_key).toBe('!env PS_ADMIN_TOKEN');
    });

    it('respects --directory flag', async () => {
      const customDir = 'my-powersync';
      mkdirSync(join(tmpDir, customDir), { recursive: true });
      writeServiceYaml(join(tmpDir, customDir), 'self-hosted');
      process.env.PS_ADMIN_TOKEN = 'k';
      const { stdout } = await runLinkSelfHostedDirect([`--directory=${customDir}`, '--api-url=https://example.com']);
      expect(stdout).toContain(`Updated ${customDir}/${CLI_FILENAME}`);
      const linkYaml = parseYaml(readFileSync(join(tmpDir, customDir, CLI_FILENAME), 'utf8'));
      expect(linkYaml.type).toBe('self-hosted');
      expect(linkYaml.api_url).toBe('https://example.com');
    });
  });
});
