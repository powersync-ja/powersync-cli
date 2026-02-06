import { runCommand } from '@oclif/test';
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

  it('creates project with default directory and type', async () => {
    const { stdout } = await runCommand('init', { root });
    expect(stdout).toContain('Created PowerSync cloud project');
    const projectDir = join(tmpDir, 'powersync');
    const serviceYamlPath = join(projectDir, 'service.yaml');
    expect(existsSync(serviceYamlPath)).toBe(true);
    expect(existsSync(join(projectDir, 'sync.yaml'))).toBe(true);
    const serviceYaml = parseYaml(readFileSync(serviceYamlPath, 'utf8'));
    expect(serviceYaml.telemetry).toBeUndefined();
    const linkYamlPath = join(projectDir, 'link.yaml');
    expect(existsSync(linkYamlPath)).toBe(true);
    const linkYaml = parseYaml(readFileSync(linkYamlPath, 'utf8'));
    expect(linkYaml.type).toBe('cloud');
  });

  it('errors when directory already exists', async () => {
    mkdirSync(join(tmpDir, EXISTING_DIR), { recursive: true });
    const result = await runCommand(`init --directory=${EXISTING_DIR}`, {
      root
    });
    expect(result.error?.message).toMatch(
      new RegExp(
        `Directory "${EXISTING_DIR}" already exists. Delete the folder to start over, or link existing config to PowerSync Cloud with \`powersync link\`.`
      )
    );
    expect(result.error?.oclif?.exit).toBe(1);
  });

  it('creates project with --directory flag', async () => {
    const { stdout } = await runCommand(`init --directory=${CUSTOM_DIR}`, {
      root
    });
    expect(stdout).toContain(`Created PowerSync cloud project`);
    const projectDir = join(tmpDir, CUSTOM_DIR);
    const serviceYamlPath = join(projectDir, 'service.yaml');
    expect(existsSync(serviceYamlPath)).toBe(true);
    expect(existsSync(join(projectDir, 'sync.yaml'))).toBe(true);
    const serviceYaml = parseYaml(readFileSync(serviceYamlPath, 'utf8'));
    expect(serviceYaml.telemetry).toBeUndefined();
    const linkYamlPath = join(projectDir, 'link.yaml');
    expect(existsSync(linkYamlPath)).toBe(true);
    const linkYaml = parseYaml(readFileSync(linkYamlPath, 'utf8'));
    expect(linkYaml.type).toBe('cloud');
  });

  it('creates self-hosted project with --type=self-hosted', async () => {
    const { stdout } = await runCommand(`init --type=self-hosted --directory=${CUSTOM_DIR}`, { root });
    expect(stdout).toContain(`Created PowerSync self-hosted project`);
    const projectDir = join(tmpDir, CUSTOM_DIR);
    const serviceYamlPath = join(projectDir, 'service.yaml');
    expect(existsSync(serviceYamlPath)).toBe(true);
    expect(existsSync(join(projectDir, 'sync.yaml'))).toBe(true);
    const serviceYaml = parseYaml(readFileSync(serviceYamlPath, 'utf8'));
    expect(serviceYaml.telemetry).toBeDefined();
    expect(serviceYaml.telemetry.disable_telemetry_sharing).toBe(false);
    const linkYamlPath = join(projectDir, 'link.yaml');
    expect(existsSync(linkYamlPath)).toBe(true);
    const linkYaml = parseYaml(readFileSync(linkYamlPath, 'utf8'));
    expect(linkYaml.type).toBe('self-hosted');
  });
});
