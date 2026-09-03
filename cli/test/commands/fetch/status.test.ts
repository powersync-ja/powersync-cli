import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import { CLI_FILENAME, SERVICE_FILENAME } from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import FetchStatus from '../../../src/commands/fetch/status.js';
import { root } from '../../helpers/root.js';
import { managementClientMock, MOCK_CLOUD_IDS, resetManagementClientMocks } from '../../setup.js';

const { instanceId: INSTANCE_ID, orgId: ORG_ID, projectId: PROJECT_ID } = MOCK_CLOUD_IDS;
const API_URL = 'https://ps.example.com';

const DIAGNOSTICS = {
  connections: [{ connected: true, errors: [], id: 'default', postgres_uri: 'postgres://host/db' }]
};

/** Run status by instantiating the command directly so the managementClientMock applies. */
async function runStatusDirect(args: string[] = []) {
  const config = await Config.load({ root });
  const cmd = new FetchStatus(args, config);
  cmd.cloudClient = managementClientMock as unknown as FetchStatus['cloudClient'];
  return captureOutput(() => cmd.run());
}

describe('fetch status', () => {
  let tmpDir: string;
  let origCwd: string;
  let projectDir: string;

  beforeEach(() => {
    resetManagementClientMocks();
    origCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'status-test-'));
    process.chdir(tmpDir);
    projectDir = join(tmpDir, 'powersync');
    mkdirSync(projectDir, { recursive: true });
    managementClientMock.getInstanceStatus.mockResolvedValue({ operations: [], provisioned: true });
    managementClientMock.getInstanceDiagnostics.mockResolvedValue(DIAGNOSTICS);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(origCwd);
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  function linkCloud() {
    writeFileSync(join(projectDir, SERVICE_FILENAME), '_type: cloud\n', 'utf8');
    writeFileSync(
      join(projectDir, CLI_FILENAME),
      `type: cloud\ninstance_id: ${INSTANCE_ID}\norg_id: ${ORG_ID}\nproject_id: ${PROJECT_ID}\n`,
      'utf8'
    );
  }

  it('prints the target Cloud instance before the diagnostics', async () => {
    linkCloud();

    const result = await runStatusDirect();

    expect(result.error).toBeUndefined();
    expect(managementClientMock.getInstance).toHaveBeenCalledTimes(1);
    expect(result.stdout).toContain('Target instance: test-instance');
    expect(result.stdout).toContain(`id: ${INSTANCE_ID}`);
    expect(result.stdout).toContain(`project: ${PROJECT_ID}`);
    expect(result.stdout).toContain(`org: ${ORG_ID}`);
    expect(result.stdout.indexOf('Target instance:')).toBeLessThan(result.stdout.indexOf('Connections'));
  });

  it('keeps json output machine readable', async () => {
    linkCloud();

    const result = await runStatusDirect(['--output=json']);

    expect(result.error).toBeUndefined();
    expect(result.stdout).not.toContain('Target instance');
    expect(JSON.parse(result.stdout)).toEqual(DIAGNOSTICS);
  });

  it('prints the API URL for a self-hosted instance', async () => {
    writeFileSync(join(projectDir, SERVICE_FILENAME), '_type: self-hosted\n', 'utf8');
    writeFileSync(join(projectDir, CLI_FILENAME), `type: self-hosted\napi_url: ${API_URL}\napi_key: key\n`, 'utf8');
    vi.spyOn(FetchStatus.prototype, 'getSelfHostedStatus').mockResolvedValue(DIAGNOSTICS);

    const result = await runStatusDirect();

    expect(result.error).toBeUndefined();
    expect(managementClientMock.getInstance).not.toHaveBeenCalled();
    expect(result.stdout).toContain(`Target instance: ${API_URL} (self-hosted)`);
    expect(result.stdout).toContain('Connections');
  });
});
