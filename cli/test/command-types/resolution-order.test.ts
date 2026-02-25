import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import { CloudInstanceCommand, env, SharedInstanceCommand } from '@powersync/cli-core';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DestroyCommand from '../../src/commands/destroy.js';
import FetchStatusCommand from '../../src/commands/fetch/status.js';
import { root } from '../helpers/root.js';

type EnvSnapshot = {
  API_URL: string | undefined;
  INSTANCE_ID: string | undefined;
  ORG_ID: string | undefined;
  PROJECT_ID: string | undefined;
  TOKEN: string | undefined;
};

describe('instance resolution order', () => {
  let oclifConfig: Config;
  let tmpRoot: string;
  let origCwd: string;
  let envSnapshot: EnvSnapshot;

  async function runDestroyDirect(args: string[]) {
    const command = new DestroyCommand(args, oclifConfig);
    return captureOutput(() => command.run());
  }

  async function runFetchStatusDirect(args: string[]) {
    const command = new FetchStatusCommand(args, oclifConfig);
    return captureOutput(() => command.run());
  }

  beforeEach(async () => {
    oclifConfig = await Config.load({ root });
    origCwd = process.cwd();
    tmpRoot = mkdtempSync(join(tmpdir(), 'resolution-order-'));
    process.chdir(tmpRoot);
    envSnapshot = {
      API_URL: env.API_URL,
      INSTANCE_ID: env.INSTANCE_ID,
      ORG_ID: env.ORG_ID,
      PROJECT_ID: env.PROJECT_ID,
      TOKEN: env.TOKEN
    };
  });

  afterEach(() => {
    process.chdir(origCwd);
    env.API_URL = envSnapshot.API_URL;
    env.INSTANCE_ID = envSnapshot.INSTANCE_ID;
    env.ORG_ID = envSnapshot.ORG_ID;
    env.PROJECT_ID = envSnapshot.PROJECT_ID;
    env.TOKEN = envSnapshot.TOKEN;
    vi.restoreAllMocks();
    rmSync(tmpRoot, { force: true, recursive: true });
  });

  it('CloudInstanceCommand resolves cloud fields as flag → cli.yaml → env', async () => {
    const projectDir = join(tmpRoot, 'powersync');
    const cliPath = join(projectDir, 'cli.yaml');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      cliPath,
      ['type: cloud', 'instance_id: cli-inst', 'org_id: cli-org', 'project_id: cli-proj', ''].join('\n'),
      'utf8'
    );

    env.INSTANCE_ID = 'env-inst';
    env.ORG_ID = 'env-org';
    env.PROJECT_ID = 'env-proj';

    const loadProjectSpy = vi.spyOn(CloudInstanceCommand.prototype, 'loadProject');

    await runDestroyDirect(['--confirm=yes', '--instance-id=flag-inst', '--org-id=flag-org', '--project-id=flag-proj']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(1);
    const fromFlag = await loadProjectSpy.mock.results[0]!.value;
    expect(fromFlag.linked.instance_id).toBe('flag-inst');
    expect(fromFlag.linked.org_id).toBe('flag-org');
    expect(fromFlag.linked.project_id).toBe('flag-proj');

    await runDestroyDirect(['--confirm=yes']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(2);
    const fromCli = await loadProjectSpy.mock.results[1]!.value;
    expect(fromCli.linked.instance_id).toBe('cli-inst');
    expect(fromCli.linked.org_id).toBe('cli-org');
    expect(fromCli.linked.project_id).toBe('cli-proj');

    rmSync(cliPath, { force: true });
    await runDestroyDirect(['--confirm=yes']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(3);
    const fromEnv = await loadProjectSpy.mock.results[2]!.value;
    expect(fromEnv.linked.instance_id).toBe('env-inst');
    expect(fromEnv.linked.org_id).toBe('env-org');
    expect(fromEnv.linked.project_id).toBe('env-proj');
  });

  it('SharedInstanceCommand resolves self-hosted api_url as flag → cli.yaml → env', async () => {
    const projectDir = join(tmpRoot, 'powersync');
    const cliPath = join(projectDir, 'cli.yaml');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: self-hosted\n', 'utf8');
    writeFileSync(
      cliPath,
      ['type: self-hosted', 'api_url: https://cli.example.com', 'api_key: cli-key', ''].join('\n'),
      'utf8'
    );

    env.API_URL = 'https://env.example.com';
    env.TOKEN = 'env-token';

    const loadProjectSpy = vi.spyOn(SharedInstanceCommand.prototype, 'loadProject');
    vi.spyOn(FetchStatusCommand.prototype, 'getSelfHostedStatus').mockRejectedValue(new Error('expected-test-failure'));

    await runFetchStatusDirect(['--output=json', '--api-url=https://flag.example.com']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(1);
    const fromCli = await loadProjectSpy.mock.results[0]!.value;
    expect(fromCli.linked.type).toBe('self-hosted');
    expect(fromCli.linked.api_url).toBe('https://flag.example.com');

    await runFetchStatusDirect(['--output=json']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(2);
    const fromLink = await loadProjectSpy.mock.results[1]!.value;
    expect(fromLink.linked.type).toBe('self-hosted');
    expect(fromLink.linked.api_url).toBe('https://cli.example.com');

    rmSync(cliPath, { force: true });
    await runFetchStatusDirect(['--output=json']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(3);
    const fromEnv = await loadProjectSpy.mock.results[2]!.value;
    expect(fromEnv.linked.type).toBe('self-hosted');
    expect(fromEnv.linked.api_url).toBe('https://env.example.com');
  });

  it('SharedInstanceCommand resolves cloud context and fields as flag → cli.yaml → env', async () => {
    const projectDir = join(tmpRoot, 'powersync');
    const cliPath = join(projectDir, 'cli.yaml');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      cliPath,
      ['type: cloud', 'instance_id: cli-inst', 'org_id: cli-org', 'project_id: cli-proj', ''].join('\n'),
      'utf8'
    );

    env.API_URL = 'https://env-self-hosted.example.com';
    env.INSTANCE_ID = 'env-inst';
    env.ORG_ID = 'env-org';
    env.PROJECT_ID = 'env-proj';

    const loadProjectSpy = vi.spyOn(SharedInstanceCommand.prototype, 'loadProject');
    vi.spyOn(FetchStatusCommand.prototype, 'getCloudStatus').mockRejectedValue(new Error('expected-test-failure'));

    await runFetchStatusDirect([
      '--output=json',
      '--instance-id=flag-inst',
      '--org-id=flag-org',
      '--project-id=flag-proj'
    ]);
    expect(loadProjectSpy).toHaveBeenCalledTimes(1);
    const fromCli = await loadProjectSpy.mock.results[0]!.value;
    expect(fromCli.linked.type).toBe('cloud');
    expect(fromCli.linked.instance_id).toBe('flag-inst');
    expect(fromCli.linked.org_id).toBe('flag-org');
    expect(fromCli.linked.project_id).toBe('flag-proj');

    await runFetchStatusDirect(['--output=json']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(2);
    const fromLink = await loadProjectSpy.mock.results[1]!.value;
    expect(fromLink.linked.type).toBe('cloud');
    expect(fromLink.linked.instance_id).toBe('cli-inst');
    expect(fromLink.linked.org_id).toBe('cli-org');
    expect(fromLink.linked.project_id).toBe('cli-proj');

    rmSync(cliPath, { force: true });
    env.API_URL = undefined;
    await runFetchStatusDirect(['--output=json']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(3);
    const fromEnv = await loadProjectSpy.mock.results[2]!.value;
    expect(fromEnv.linked.type).toBe('cloud');
    expect(fromEnv.linked.instance_id).toBe('env-inst');
    expect(fromEnv.linked.org_id).toBe('env-org');
    expect(fromEnv.linked.project_id).toBe('env-proj');
  });
});
