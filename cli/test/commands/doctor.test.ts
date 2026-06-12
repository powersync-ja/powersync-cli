import { runCommand } from '@oclif/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, onTestFinished } from 'vitest';

import { root } from '../helpers/root.js';

function writeConfig(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'doctor-test-'));
  onTestFinished(() => rmSync(directory, { recursive: true }));
  const path = join(directory, 'sync-config.yaml');
  writeFileSync(path, contents);
  return path;
}

describe('doctor', () => {
  it('exits 0 with no findings on a clean config', async () => {
    const path = writeConfig(`
config:
  edition: 2
streams:
  todos:
    auto_subscribe: true
    query: |
      SELECT * FROM todos WHERE user_id = auth.user_id()
`);

    const result = await runCommand(`doctor --sync-config-file-path ${path} --output=json`, { root });

    expect(result.error).toBeUndefined();
    const report = JSON.parse(result.stdout);
    expect(report.findings).toEqual([]);
    expect(report.exit).toBe(0);
    expect(report.budget.exceeded).toBe(false);
  });

  it('flags an unbounded stream and exits non-zero', async () => {
    const path = writeConfig(`
streams:
  all_widgets:
    query: |
      SELECT * FROM widgets
`);

    const result = await runCommand(`doctor --sync-config-file-path ${path} --output=json`, { root });

    expect(result.error?.oclif?.exit).toBeGreaterThan(0);
    const report = JSON.parse(result.stdout);
    expect(report.findings.map((f: { rule: string }) => f.rule)).toContain('unbounded-membership');
    expect(report.exit).toBeGreaterThan(0);
  });

  it('errors out with --user-id missing when --db is set without a JWT sub claim', async () => {
    const path = writeConfig(`
config:
  edition: 2
streams:
  todos:
    auto_subscribe: true
    query: |
      SELECT * FROM todos WHERE user_id = auth.user_id()
`);

    const result = await runCommand(
      `doctor --sync-config-file-path ${path} --db postgres://localhost/nope --output=json`,
      { root }
    );

    expect(result.error).toBeDefined();
    expect(String(result.error?.message)).toContain('--user-id is required');
  });
});
