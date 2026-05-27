import { Config } from '@oclif/core';
import { captureOutput, runCommand } from '@oclif/test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import CompactCommand from '../../src/commands/compact.js';
import { root } from '../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../setup.js';

const CLI_FILENAME = 'cli.yaml';
const PROJECT_DIR = 'powersync';
const SERVICE_FILENAME = 'service.yaml';
const INSTANCE_ID = MOCK_CLOUD_IDS.instanceId;
const ORG_ID = MOCK_CLOUD_IDS.orgId;
const PROJECT_ID = MOCK_CLOUD_IDS.projectId;
const OPERATION_ID = 'op-compact-123';

function writeServiceYaml(projectDir: string, type: 'cloud' | 'self-hosted') {
  writeFileSync(join(projectDir, SERVICE_FILENAME), `_type: ${type}\nregion: us\n`, 'utf8');
}

function writeLinkYaml(projectDir: string, opts: { instance_id: string; org_id: string; project_id: string }) {
  const content = `type: cloud\ninstance_id: ${opts.instance_id}\norg_id: ${opts.org_id}\nproject_id: ${opts.project_id}\n`;
  writeFileSync(join(projectDir, CLI_FILENAME), content, 'utf8');
}

describe('compact', () => {
  let oclifConfig: Config;
  let tmpDir: string;
  let origCwd: string;
  let origPsToken: string | undefined;

  beforeAll(async () => {
    oclifConfig = await Config.load({ root });
  });

  async function runCompactDirect(args: string[]) {
    const cmd = new CompactCommand(args, oclifConfig);
    cmd.client = managementClientMock as unknown as CompactCommand['client'];
    return captureOutput(() => cmd.run());
  }

  beforeEach(() => {
    resetManagementClientMocks();

    origCwd = process.cwd();
    origPsToken = process.env.PS_ADMIN_TOKEN;
    tmpDir = mkdtempSync(join(tmpdir(), 'compact-test-'));
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

  it('errors when directory does not exist', async () => {
    const result = await runCommand('compact', { root });
    expect(result.error?.message).toMatch(/Directory "powersync" not found/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when cli.yaml does not exist (missing link)', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'cloud');
    const result = await runCommand('compact', { root });
    expect(result.error?.message).toContain('Linking is required');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('errors when service.yaml _type is self-hosted', async () => {
    const projectDir = join(tmpDir, PROJECT_DIR);
    mkdirSync(projectDir, { recursive: true });
    writeServiceYaml(projectDir, 'self-hosted');
    writeLinkYaml(projectDir, { instance_id: 'i', org_id: 'o', project_id: 'p' });
    const result = await runCommand('compact', { root });
    expect(result.error?.message).toMatch(/has `_type: self-hosted` but this command requires `_type: cloud`/);
    expect(result.error?.oclif?.exit).toBe(1);
  });

  describe('with valid cloud project', () => {
    beforeEach(async () => {
      const projectDir = join(tmpDir, PROJECT_DIR);
      mkdirSync(projectDir, { recursive: true });
      writeServiceYaml(projectDir, 'cloud');
      writeLinkYaml(projectDir, { instance_id: INSTANCE_ID, org_id: ORG_ID, project_id: PROJECT_ID });
    });

    it('calls compact on the management client with linked ids', async () => {
      managementClientMock.compact.mockResolvedValue({ id: INSTANCE_ID });

      await runCompactDirect([]);

      expect(managementClientMock.compact).toHaveBeenCalledTimes(1);
      expect(managementClientMock.compact).toHaveBeenCalledWith({
        app_id: PROJECT_ID,
        id: INSTANCE_ID,
        org_id: ORG_ID
      });
    });

    it('reports success when compact returns no operation_id', async () => {
      managementClientMock.compact.mockResolvedValue({ id: INSTANCE_ID });

      const result = await runCompactDirect([]);

      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('Instance compacted successfully.');
      expect(managementClientMock.getInstanceStatus).not.toHaveBeenCalled();
    });

    it('polls operation status and reports success when status completes', async () => {
      managementClientMock.compact.mockResolvedValue({ id: INSTANCE_ID, operation_id: OPERATION_ID });
      managementClientMock.getInstanceStatus.mockResolvedValue({
        operations: [{ id: OPERATION_ID, status: 'completed' }],
        provisioned: true
      });

      const result = await runCompactDirect([]);

      expect(managementClientMock.getInstanceStatus).toHaveBeenCalledWith({
        app_id: PROJECT_ID,
        id: INSTANCE_ID,
        org_id: ORG_ID
      });
      expect(result.error).toBeUndefined();
      expect(result.stdout).toContain('Instance compacted successfully.');
    });

    it('errors when polling reports a failed status', async () => {
      managementClientMock.compact.mockResolvedValue({ id: INSTANCE_ID, operation_id: OPERATION_ID });
      managementClientMock.getInstanceStatus.mockResolvedValue({
        operations: [{ id: OPERATION_ID, status: 'failed' }],
        provisioned: true
      });

      const result = await runCompactDirect([]);

      expect(result.error?.message).toMatch(/Operation failed\. Check instance diagnostics/);
      expect(result.error?.message).toContain('powersync status');
      expect(result.error?.oclif?.exit).toBe(1);
    });

    it('rejects negative --timeout values', async () => {
      const result = await runCompactDirect(['--timeout=-5']);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toMatch(/Expected an integer greater than or equal to 0/);
      expect(managementClientMock.compact).not.toHaveBeenCalled();
    });

    it('errors with exit 1 when client compact call fails (network error)', async () => {
      managementClientMock.compact.mockRejectedValue(new Error('network down'));

      const result = await runCompactDirect([]);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toMatch(
        new RegExp(`Failed to compact instance ${INSTANCE_ID} in project ${PROJECT_ID} in org ${ORG_ID}`)
      );
      expect(result.error?.oclif?.exit).toBe(1);
    });
  });
});
