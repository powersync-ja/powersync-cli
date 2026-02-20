import { runCommand } from '@oclif/test';
import { YAML_CLI_SCHEMA, YAML_SERVICE_SCHEMA, YAML_SYNC_RULES_SCHEMA } from '@powersync/cli-core';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { root } from '../helpers/root.js';

const CUSTOM_DIR = 'custom-dir';
const EXISTING_DIR = 'existing-dir';

describe('init', () => {
  let tmpDir: string;
  let origCwd: string;

  beforeEach(() => {
    origCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), 'init-test-'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('creates project with default directory (init cloud)', async () => {
    await runCommand('init cloud', { root });
    const projectDir = join(tmpDir, 'powersync');
    const serviceYamlPath = join(projectDir, 'service.yaml');
    const syncYamlPath = join(projectDir, 'sync.yaml');
    expect(existsSync(serviceYamlPath)).toBe(true);
    expect(existsSync(syncYamlPath)).toBe(true);
    expect(readFileSync(serviceYamlPath, 'utf8')).toContain(YAML_SERVICE_SCHEMA);
    expect(readFileSync(syncYamlPath, 'utf8')).toContain(YAML_SYNC_RULES_SCHEMA);
    const serviceYaml = parseYaml(readFileSync(serviceYamlPath, 'utf8'));
    expect(serviceYaml.telemetry).toBeUndefined();
    const linkYamlPath = join(projectDir, 'cli.yaml');
    expect(existsSync(linkYamlPath)).toBe(true);
    expect(readFileSync(linkYamlPath, 'utf8')).toContain(YAML_CLI_SCHEMA);
    const linkYaml = parseYaml(readFileSync(linkYamlPath, 'utf8'));
    expect(linkYaml.type).toBe('cloud');
  });

  it('errors when directory already exists', async () => {
    mkdirSync(join(tmpDir, EXISTING_DIR), { recursive: true });
    const result = await runCommand(`init cloud --directory=${EXISTING_DIR}`, {
      root
    });
    expect(result.error?.message).toContain('Directory "');
    expect(result.error?.message).toContain('" already exists');
    expect(result.error?.message).toContain('powersync link');
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('creates project with --directory flag', async () => {
    await runCommand(`init cloud --directory=${CUSTOM_DIR}`, {
      root
    });
    const projectDir = join(tmpDir, CUSTOM_DIR);
    const serviceYamlPath = join(projectDir, 'service.yaml');
    const syncYamlPath = join(projectDir, 'sync.yaml');
    expect(existsSync(serviceYamlPath)).toBe(true);
    expect(existsSync(syncYamlPath)).toBe(true);
    expect(readFileSync(serviceYamlPath, 'utf8')).toContain(YAML_SERVICE_SCHEMA);
    expect(readFileSync(syncYamlPath, 'utf8')).toContain(YAML_SYNC_RULES_SCHEMA);
    const serviceYaml = parseYaml(readFileSync(serviceYamlPath, 'utf8'));
    expect(serviceYaml.telemetry).toBeUndefined();
    const linkYamlPath = join(projectDir, 'cli.yaml');
    expect(existsSync(linkYamlPath)).toBe(true);
    expect(readFileSync(linkYamlPath, 'utf8')).toContain(YAML_CLI_SCHEMA);
    const linkYaml = parseYaml(readFileSync(linkYamlPath, 'utf8'));
    expect(linkYaml.type).toBe('cloud');
  });

  it('creates self-hosted project with init self-hosted', async () => {
    await runCommand(`init self-hosted --directory=${CUSTOM_DIR}`, { root });
    const projectDir = join(tmpDir, CUSTOM_DIR);
    const serviceYamlPath = join(projectDir, 'service.yaml');
    const syncYamlPath = join(projectDir, 'sync.yaml');
    expect(existsSync(serviceYamlPath)).toBe(true);
    expect(existsSync(syncYamlPath)).toBe(true);
    expect(readFileSync(serviceYamlPath, 'utf8')).toContain(YAML_SERVICE_SCHEMA);
    expect(readFileSync(syncYamlPath, 'utf8')).toContain(YAML_SYNC_RULES_SCHEMA);
    const serviceYaml = parseYaml(readFileSync(serviceYamlPath, 'utf8'));
    expect(serviceYaml.telemetry).toBeDefined();
    expect(serviceYaml.telemetry.disable_telemetry_sharing).toBe(false);
    const linkYamlPath = join(projectDir, 'cli.yaml');
    expect(existsSync(linkYamlPath)).toBe(true);
    expect(readFileSync(linkYamlPath, 'utf8')).toContain(YAML_CLI_SCHEMA);
    const linkYaml = parseYaml(readFileSync(linkYamlPath, 'utf8'));
    expect(linkYaml.type).toBe('self-hosted');
  });
});
