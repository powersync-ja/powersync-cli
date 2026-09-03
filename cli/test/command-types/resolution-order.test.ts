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
import { managementClientMock, MOCK_CLOUD_IDS } from '../setup.js';

type EnvSnapshot = {
  API_URL: string | undefined;
  INSTANCE_ID: string | undefined;
  POWERSYNC_TARGET: string | undefined;
  PS_ADMIN_TOKEN: string | undefined;
};

const IDS = {
  cli: {
    instance: '699f191ade6e1187bd89815b',
    org: '4ffabc821ea10f9b2a000001',
    project: '699ef9c371c56d0007320543'
  },
  env: {
    instance: '699f191ade6e1187bd89815c',
    org: '4ffabc821ea10f9b2a000002',
    project: '699ef9c371c56d0007320544'
  },
  flag: {
    instance: '699f191ade6e1187bd89815d',
    org: '4ffabc821ea10f9b2a000003',
    project: '699ef9c371c56d0007320545'
  }
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
      POWERSYNC_TARGET: env.POWERSYNC_TARGET,
      PS_ADMIN_TOKEN: env.PS_ADMIN_TOKEN
    };
  });

  afterEach(() => {
    process.chdir(origCwd);
    env.API_URL = envSnapshot.API_URL;
    env.INSTANCE_ID = envSnapshot.INSTANCE_ID;
    env.POWERSYNC_TARGET = envSnapshot.POWERSYNC_TARGET;
    env.PS_ADMIN_TOKEN = envSnapshot.PS_ADMIN_TOKEN;
    vi.restoreAllMocks();
    rmSync(tmpRoot, { force: true, recursive: true });
  });

  it('CloudInstanceCommand resolves instance_id as flag → cli.yaml → env; org/project from cli.yaml or API', async () => {
    // getInstance echoes the requested id so we can verify which instance was resolved
    managementClientMock.getInstance.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({ app_id: MOCK_CLOUD_IDS.projectId, id, org_id: MOCK_CLOUD_IDS.orgId })
    );

    const projectDir = join(tmpRoot, 'powersync');
    const cliPath = join(projectDir, 'cli.yaml');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      cliPath,
      [
        'type: cloud',
        `instance_id: ${IDS.cli.instance}`,
        `org_id: ${IDS.cli.org}`,
        `project_id: ${IDS.cli.project}`,
        ''
      ].join('\n'),
      'utf8'
    );

    env.INSTANCE_ID = IDS.env.instance;

    const loadProjectSpy = vi.spyOn(CloudInstanceCommand.prototype, 'loadProject');

    // Flag takes precedence for instance_id; org/project come from cli.yaml (API skipped when both present)
    await runDestroyDirect(['--confirm=yes', `--instance-id=${IDS.flag.instance}`]);
    expect(loadProjectSpy).toHaveBeenCalledTimes(1);
    const fromFlag = await loadProjectSpy.mock.results[0]!.value;
    expect(fromFlag.linked.instance_id).toBe(IDS.flag.instance);
    expect(fromFlag.linked.org_id).toBe(IDS.cli.org);
    expect(fromFlag.linked.project_id).toBe(IDS.cli.project);

    // cli.yaml is the source for all three fields when no flag is passed
    await runDestroyDirect(['--confirm=yes']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(2);
    const fromCli = await loadProjectSpy.mock.results[1]!.value;
    expect(fromCli.linked.instance_id).toBe(IDS.cli.instance);
    expect(fromCli.linked.org_id).toBe(IDS.cli.org);
    expect(fromCli.linked.project_id).toBe(IDS.cli.project);

    // With no cli.yaml, instance_id comes from env and org/project are resolved via getInstance
    rmSync(cliPath, { force: true });
    await runDestroyDirect(['--confirm=yes']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(3);
    const fromEnv = await loadProjectSpy.mock.results[2]!.value;
    expect(fromEnv.linked.instance_id).toBe(IDS.env.instance);
    expect(fromEnv.linked.org_id).toBe(MOCK_CLOUD_IDS.orgId);
    expect(fromEnv.linked.project_id).toBe(MOCK_CLOUD_IDS.projectId);
  });

  it('CloudInstanceCommand rejects invalid cloud BSON ObjectID values', async () => {
    const projectDir = join(tmpRoot, 'powersync');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      join(projectDir, 'cli.yaml'),
      [
        'type: cloud',
        'instance_id: invalid/instance',
        `org_id: ${IDS.cli.org}`,
        `project_id: ${IDS.cli.project}`,
        ''
      ].join('\n'),
      'utf8'
    );

    const { error } = await runDestroyDirect(['--confirm=yes']);
    expect(error?.message).toContain('Invalid instance_id in cli.yaml');
  });

  it('CloudInstanceCommand selects a cli.yaml target from --target or POWERSYNC_TARGET', async () => {
    managementClientMock.getInstance.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({ app_id: MOCK_CLOUD_IDS.projectId, id, org_id: MOCK_CLOUD_IDS.orgId })
    );

    const projectDir = join(tmpRoot, 'powersync');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      join(projectDir, 'cli.yaml'),
      [
        'type: cloud',
        `instance_id: ${IDS.cli.instance}`,
        `org_id: ${IDS.cli.org}`,
        `project_id: ${IDS.cli.project}`,
        'targets:',
        '  staging:',
        `    instance_id: ${IDS.env.instance}`,
        `    org_id: ${IDS.env.org}`,
        `    project_id: ${IDS.env.project}`,
        '  production:',
        `    instance_id: ${IDS.flag.instance}`,
        ''
      ].join('\n'),
      'utf8'
    );

    const loadProjectSpy = vi.spyOn(CloudInstanceCommand.prototype, 'loadProject');

    // --target picks the named entry, including its org/project
    await runDestroyDirect(['--confirm=yes', '--target=staging']);
    const fromFlag = await loadProjectSpy.mock.results[0]!.value;
    expect(fromFlag.target).toBe('staging');
    expect(fromFlag.linked.instance_id).toBe(IDS.env.instance);
    expect(fromFlag.linked.org_id).toBe(IDS.env.org);
    expect(fromFlag.linked.project_id).toBe(IDS.env.project);

    // POWERSYNC_TARGET selects an entry too; its missing org/project are resolved via getInstance
    env.POWERSYNC_TARGET = 'production';
    await runDestroyDirect(['--confirm=yes']);
    const fromEnv = await loadProjectSpy.mock.results[1]!.value;
    expect(fromEnv.target).toBe('production');
    expect(fromEnv.linked.instance_id).toBe(IDS.flag.instance);
    expect(fromEnv.linked.org_id).toBe(MOCK_CLOUD_IDS.orgId);
    expect(fromEnv.linked.project_id).toBe(MOCK_CLOUD_IDS.projectId);

    // --instance-id wins over the selected target and uses the top-level org/project
    await runDestroyDirect(['--confirm=yes', `--instance-id=${IDS.env.instance}`]);
    const fromInstanceFlag = await loadProjectSpy.mock.results[2]!.value;
    expect(fromInstanceFlag.target).toBeUndefined();
    expect(fromInstanceFlag.linked.instance_id).toBe(IDS.env.instance);
    expect(fromInstanceFlag.linked.org_id).toBe(IDS.cli.org);
    expect(fromInstanceFlag.linked.project_id).toBe(IDS.cli.project);
  });

  it('CloudInstanceCommand rejects an unknown target and --target combined with --instance-id', async () => {
    const projectDir = join(tmpRoot, 'powersync');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      join(projectDir, 'cli.yaml'),
      ['type: cloud', 'targets:', '  staging:', `    instance_id: ${IDS.env.instance}`, ''].join('\n'),
      'utf8'
    );

    const unknown = await runDestroyDirect(['--confirm=yes', '--target=production']);
    expect(unknown.error?.message).toContain('Target "production" is not defined in cli.yaml');
    expect(unknown.error?.message).toContain('staging');

    // No default link and no selection: point at the targets that do exist
    const unselected = await runDestroyDirect(['--confirm=yes']);
    expect(unselected.error?.message).toContain('Linking is required');
    expect(unselected.error?.suggestions?.[0]).toContain('--target or POWERSYNC_TARGET: staging');

    const exclusive = await runDestroyDirect([
      '--confirm=yes',
      '--target=staging',
      `--instance-id=${IDS.cli.instance}`
    ]);
    expect(exclusive.error?.message).toContain('cannot also be provided');
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
    env.PS_ADMIN_TOKEN = 'env-token';

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

  it('SharedInstanceCommand selects a cli.yaml target from --target or POWERSYNC_TARGET', async () => {
    const projectDir = join(tmpRoot, 'powersync');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      join(projectDir, 'cli.yaml'),
      [
        'type: cloud',
        'targets:',
        '  staging:',
        `    instance_id: ${IDS.env.instance}`,
        `    org_id: ${IDS.env.org}`,
        `    project_id: ${IDS.env.project}`,
        ''
      ].join('\n'),
      'utf8'
    );

    const loadProjectSpy = vi.spyOn(SharedInstanceCommand.prototype, 'loadProject');
    vi.spyOn(FetchStatusCommand.prototype, 'getCloudStatus').mockRejectedValue(new Error('expected-test-failure'));

    await runFetchStatusDirect(['--output=json', '--target=staging']);
    const fromFlag = await loadProjectSpy.mock.results[0]!.value;
    expect(fromFlag.target).toBe('staging');
    expect(fromFlag.linked.type).toBe('cloud');
    expect(fromFlag.linked.instance_id).toBe(IDS.env.instance);
    expect(fromFlag.linked.org_id).toBe(IDS.env.org);
    expect(fromFlag.linked.project_id).toBe(IDS.env.project);

    env.POWERSYNC_TARGET = 'staging';
    await runFetchStatusDirect(['--output=json']);
    const fromEnv = await loadProjectSpy.mock.results[1]!.value;
    expect(fromEnv.target).toBe('staging');
    expect(fromEnv.linked.instance_id).toBe(IDS.env.instance);

    env.POWERSYNC_TARGET = undefined;
    const unselected = await runFetchStatusDirect(['--output=json']);
    expect(unselected.error?.message).toContain('Linking is required');
    expect(unselected.error?.suggestions?.[0]).toContain('--target or POWERSYNC_TARGET: staging');
  });

  it('SharedInstanceCommand lets --instance-id pick the cloud context over a self-hosted cli.yaml', async () => {
    managementClientMock.getInstance.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({ app_id: MOCK_CLOUD_IDS.projectId, id, org_id: MOCK_CLOUD_IDS.orgId })
    );

    const projectDir = join(tmpRoot, 'powersync');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, 'cli.yaml'),
      ['type: self-hosted', 'api_url: https://cli.example.com', 'api_key: cli-key', ''].join('\n'),
      'utf8'
    );

    const loadProjectSpy = vi.spyOn(SharedInstanceCommand.prototype, 'loadProject');
    vi.spyOn(FetchStatusCommand.prototype, 'getCloudStatus').mockRejectedValue(new Error('expected-test-failure'));

    await runFetchStatusDirect(['--output=json', `--instance-id=${IDS.flag.instance}`]);
    const project = await loadProjectSpy.mock.results[0]!.value;
    expect(project.linked.type).toBe('cloud');
    expect(project.linked.instance_id).toBe(IDS.flag.instance);
  });

  it('accepts a cli.yaml written by older CLI versions (no targets key)', async () => {
    managementClientMock.getInstance.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({ app_id: MOCK_CLOUD_IDS.projectId, id, org_id: MOCK_CLOUD_IDS.orgId })
    );

    const projectDir = join(tmpRoot, 'powersync');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      join(projectDir, 'cli.yaml'),
      [
        '# yaml-language-server: $schema=https://unpkg.com/@powersync/cli-schemas@latest/json-schema/cli-config.json',
        'type: cloud',
        `instance_id: ${IDS.cli.instance}`,
        `org_id: ${IDS.cli.org}`,
        `project_id: ${IDS.cli.project}`,
        ''
      ].join('\n'),
      'utf8'
    );

    const cloudSpy = vi.spyOn(CloudInstanceCommand.prototype, 'loadProject');
    await runDestroyDirect(['--confirm=yes']);
    const cloudProject = await cloudSpy.mock.results[0]!.value;
    expect(cloudProject.target).toBeUndefined();
    expect(cloudProject.linked).toEqual({
      instance_id: IDS.cli.instance,
      org_id: IDS.cli.org,
      project_id: IDS.cli.project,
      type: 'cloud'
    });

    const sharedSpy = vi.spyOn(SharedInstanceCommand.prototype, 'loadProject');
    vi.spyOn(FetchStatusCommand.prototype, 'getCloudStatus').mockRejectedValue(new Error('expected-test-failure'));
    await runFetchStatusDirect(['--output=json']);
    const sharedProject = await sharedSpy.mock.results[0]!.value;
    expect(sharedProject.target).toBeUndefined();
    expect(sharedProject.linked.instance_id).toBe(IDS.cli.instance);

    // Selecting a target on such a file explains how to add one
    const { error } = await runDestroyDirect(['--confirm=yes', '--target=staging']);
    expect(error?.message).toContain(
      'Target "staging" is not defined in cli.yaml. Add it with: powersync link cloud --target=staging'
    );
  });

  it('SharedInstanceCommand resolves cloud instance_id as flag → cli.yaml → env; org/project from cli.yaml or API', async () => {
    // getInstance echoes the requested id so we can verify which instance was resolved
    managementClientMock.getInstance.mockImplementation(({ id }: { id: string }) =>
      Promise.resolve({ app_id: MOCK_CLOUD_IDS.projectId, id, org_id: MOCK_CLOUD_IDS.orgId })
    );

    const projectDir = join(tmpRoot, 'powersync');
    const cliPath = join(projectDir, 'cli.yaml');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, 'service.yaml'), '_type: cloud\n', 'utf8');
    writeFileSync(
      cliPath,
      [
        'type: cloud',
        `instance_id: ${IDS.cli.instance}`,
        `org_id: ${IDS.cli.org}`,
        `project_id: ${IDS.cli.project}`,
        ''
      ].join('\n'),
      'utf8'
    );

    env.API_URL = 'https://env-self-hosted.example.com';
    env.INSTANCE_ID = IDS.env.instance;

    const loadProjectSpy = vi.spyOn(SharedInstanceCommand.prototype, 'loadProject');
    vi.spyOn(FetchStatusCommand.prototype, 'getCloudStatus').mockRejectedValue(new Error('expected-test-failure'));

    // Flag takes precedence for instance_id; org/project come from cli.yaml (API skipped when both present)
    await runFetchStatusDirect(['--output=json', `--instance-id=${IDS.flag.instance}`]);
    expect(loadProjectSpy).toHaveBeenCalledTimes(1);
    const fromFlag = await loadProjectSpy.mock.results[0]!.value;
    expect(fromFlag.linked.type).toBe('cloud');
    expect(fromFlag.linked.instance_id).toBe(IDS.flag.instance);
    expect(fromFlag.linked.org_id).toBe(IDS.cli.org);
    expect(fromFlag.linked.project_id).toBe(IDS.cli.project);

    // cli.yaml is the source for all three fields when no flag is passed
    await runFetchStatusDirect(['--output=json']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(2);
    const fromLink = await loadProjectSpy.mock.results[1]!.value;
    expect(fromLink.linked.type).toBe('cloud');
    expect(fromLink.linked.instance_id).toBe(IDS.cli.instance);
    expect(fromLink.linked.org_id).toBe(IDS.cli.org);
    expect(fromLink.linked.project_id).toBe(IDS.cli.project);

    // With no cli.yaml, instance_id comes from env and org/project are resolved via getInstance
    rmSync(cliPath, { force: true });
    env.API_URL = undefined;
    await runFetchStatusDirect(['--output=json']);
    expect(loadProjectSpy).toHaveBeenCalledTimes(3);
    const fromEnv = await loadProjectSpy.mock.results[2]!.value;
    expect(fromEnv.linked.type).toBe('cloud');
    expect(fromEnv.linked.instance_id).toBe(IDS.env.instance);
    expect(fromEnv.linked.org_id).toBe(MOCK_CLOUD_IDS.orgId);
    expect(fromEnv.linked.project_id).toBe(MOCK_CLOUD_IDS.projectId);
  });
});
