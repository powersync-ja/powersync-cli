import { runCommand } from '@oclif/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { root } from '../helpers/root.js';

describe('Docker Compose dashboard', () => {
  let dir: string;
  const read = (path: string) => readFileSync(join(dir, path), 'utf8');
  const write = (path: string, contents: string) => writeFileSync(join(dir, path), contents);
  const configure = (flags: string[]) => runCommand(['docker', 'configure', '--directory', dir, ...flags], { root });
  const files = ['service.yaml', 'cli.yaml', 'docker/docker-compose.yaml', 'docker/.env'];

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dashboard-config-'));
    write('service.yaml', '_type: self-hosted\napi:\n  tokens:\n    - !env PS_EXISTING_TOKEN # keep this token\n');
    write('cli.yaml', 'type: self-hosted\nplugins:\n  docker:\n    custom_setting: keep\n');
  });

  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  it.each([true, false])('preserves project settings and enables exactly once (during setup = %s)', async (atSetup) => {
    const flags = ['--database=none', '--storage=none'];
    if (atSetup) flags.push('--dashboard');
    expect((await configure(flags)).error).toBeUndefined();
    if (!atSetup) {
      expect(parse(read('docker/docker-compose.yaml')).services.dashboard).toBeUndefined();
      write('docker/.env', '# custom setting\nEXISTING=value');
      expect((await configure(['--dashboard'])).error).toBeUndefined();
      expect(read('docker/.env')).toContain('EXISTING=value\n');
    }

    const contents = files.map((file) => read(file));
    const [service, link, compose, dotenv] = contents;
    expect(service).toContain('!env PS_EXISTING_TOKEN # keep this token');
    expect(service).toContain('!env PS_DASHBOARD_TOKEN');
    const token = dotenv.match(/^PS_DASHBOARD_TOKEN=([a-f0-9]{64})$/m)?.[1];
    expect(dotenv).toContain('PS_DASHBOARD_PORT=8090\n');
    expect(dotenv).toContain('PS_DASHBOARD_ADMIN_URL=\n');
    expect(dotenv).toContain('PS_DASHBOARD_CLIENT_URL=\n');
    const { dashboard, powersync } = parse(compose).services;
    expect(dashboard.environment).toEqual({
      POWERSYNC_ADMIN_TOKEN: powersync.environment.PS_DASHBOARD_TOKEN,
      POWERSYNC_ADMIN_URL: `\${PS_DASHBOARD_ADMIN_URL:-http://powersync:\${PS_PORT:-8080}}`,
      POWERSYNC_CLIENT_URL: `\${PS_DASHBOARD_CLIENT_URL:-http://localhost:\${PS_PORT:-8080}}`
    });
    expect(powersync.environment.PS_DASHBOARD_TOKEN).toContain('PS_DASHBOARD_TOKEN');
    expect(token).toBeTruthy();
    expect(service + compose + link).not.toContain(token!);
    expect(parse(link).plugins.docker.custom_setting).toBe('keep');
    expect(parse(link).plugins.docker.dashboard).toBeUndefined();
    expect(parse(compose).services.dashboard.ports).toEqual([`127.0.0.1:\${PS_DASHBOARD_PORT:-8090}:8080`]);

    expect((await configure(['--dashboard'])).error).toBeUndefined();
    expect(files.map((file) => read(file))).toEqual(contents);
  });

  it('upgrades prior generated defaults and preserves custom settings', async () => {
    expect((await configure(['--database=none', '--storage=none', '--dashboard'])).error).toBeUndefined();
    const mapping = `127.0.0.1:\${PS_DASHBOARD_PORT:-8090}:8080`;
    const composePath = 'docker/docker-compose.yaml';
    const original = read(composePath);
    const env = parse(original).services.dashboard.environment;
    write(
      composePath,
      original
        .replace(mapping, '127.0.0.1:8090:8080')
        .replace(env.POWERSYNC_ADMIN_URL, `http://powersync:\${PS_PORT:-8080}`)
        .replace(env.POWERSYNC_CLIENT_URL, `http://localhost:\${PS_PORT:-8080}`)
    );
    const dotenv = read('docker/.env').replace('PS_DASHBOARD_PORT=8090', 'PS_DASHBOARD_PORT=9100');
    const customized = dotenv
      .replace('PS_DASHBOARD_ADMIN_URL=', 'PS_DASHBOARD_ADMIN_URL=https://admin.example.com')
      .replace('PS_DASHBOARD_CLIENT_URL=', 'PS_DASHBOARD_CLIENT_URL=https://client.example.com');
    write('docker/.env', customized);
    expect((await configure(['--dashboard'])).error).toBeUndefined();
    expect(parse(read(composePath)).services.dashboard.ports).toEqual([mapping]);
    expect(read('docker/.env')).toBe(customized);
    expect(parse(read(composePath)).services.dashboard.environment).toEqual(env);

    const custom = read(composePath)
      .replace(mapping, '127.0.0.1:9500:8080')
      .replace(env.POWERSYNC_ADMIN_URL, 'https://custom.example.com');
    write(composePath, custom);
    expect((await configure(['--dashboard'])).error).toBeUndefined();
    expect(read(composePath)).toBe(custom);
  });

  it('leaves all files intact on a dashboard service name conflict', async () => {
    expect((await configure(['--database=none', '--storage=none'])).error).toBeUndefined();
    const compose = read('docker/docker-compose.yaml').replace(
      'services:\n',
      'services:\n  dashboard: { image: custom }\n'
    );
    write('docker/docker-compose.yaml', compose);
    const before = files.map((file) => read(file));
    expect((await configure(['--dashboard'])).error?.message).toContain('already defines a dashboard');
    expect(files.map((file) => read(file))).toEqual(before);
  });
});
