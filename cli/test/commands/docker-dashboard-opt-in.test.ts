import { confirm, input } from '@inquirer/prompts';
import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDocument } from 'yaml';

import DockerConfigure from '../../../plugins/docker/src/commands/docker/configure.js';
import { root } from '../helpers/root.js';

vi.mock('@inquirer/prompts', () => ({ confirm: vi.fn(), input: vi.fn(), select: vi.fn() }));
function terminal(isTTY: boolean) {
  const stdin = Object.create(process.stdin, { isTTY: { value: isTTY } });
  vi.spyOn(process, 'stdin', 'get').mockReturnValue(stdin);
}

describe('Docker dashboard opt-in', () => {
  let dir: string;
  let config: Config;
  const read = () => readFileSync(join(dir, 'cli.yaml'), 'utf8');
  const configure = (...flags: string[]) =>
    captureOutput(() => new DockerConfigure(['--directory', dir, ...flags], config).run());

  beforeEach(async () => {
    vi.clearAllMocks();
    config = await Config.load({ root });
    dir = mkdtempSync(join(tmpdir(), 'dashboard-opt-in-'));
    writeFileSync(join(dir, 'service.yaml'), '_type: self-hosted\n');
    writeFileSync(
      join(dir, 'cli.yaml'),
      '# Keep my link\ntype: self-hosted\napi_url: http://localhost:8080\napi_key: fixture\nplugins:\n  docker:\n    project_name: myproject\n'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { force: true, recursive: true });
  });

  it.each([true, false])('uses a single dashboard opt-in on initial setup (enable = %s)', async (enable) => {
    terminal(true);
    vi.mocked(confirm).mockResolvedValue(enable);
    expect((await configure('--database=none', '--storage=none')).error).toBeUndefined();
    expect(confirm).toHaveBeenCalledExactlyOnceWith({ default: false, message: expect.stringContaining('dashboard') });
    expect(input).not.toHaveBeenCalled();
    const compose = parseDocument(readFileSync(join(dir, 'docker/docker-compose.yaml'), 'utf8'));
    expect(compose.hasIn(['services', 'dashboard'])).toBe(enable);
    expect(parseDocument(read()).hasIn(['plugins', 'docker', 'dashboard'])).toBe(false);
  });

  it('offers the dashboard on an existing stack without asking for URLs', async () => {
    terminal(false);
    expect((await configure('--database=none', '--storage=none')).error).toBeUndefined();
    expect(confirm).not.toHaveBeenCalled();
    const link = read();
    terminal(true);
    vi.mocked(confirm).mockResolvedValue(true);
    expect((await configure()).error).toBeUndefined();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(input).not.toHaveBeenCalled();
    expect(read()).toBe(link);
    expect(readFileSync(join(dir, 'docker/.env'), 'utf8')).toContain('PS_DASHBOARD_ADMIN_URL=');
  });
});
