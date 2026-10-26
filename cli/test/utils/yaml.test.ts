import { parseYamlFile } from '@powersync/cli-core';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('parseYamlFile !env', () => {
  let tmpDir: string;
  let origUri: string | undefined;

  beforeEach(() => {
    origUri = process.env.PS_DATABASE_URI;
    delete process.env.PS_DATABASE_URI;
    tmpDir = mkdtempSync(join(tmpdir(), 'yaml-env-'));
  });

  afterEach(() => {
    if (origUri === undefined) {
      delete process.env.PS_DATABASE_URI;
    } else {
      process.env.PS_DATABASE_URI = origUri;
    }

    rmSync(tmpDir, { force: true, recursive: true });
  });

  it('throws naming the missing variable instead of substituting the name', () => {
    const filePath = join(tmpDir, 'service.yaml');
    writeFileSync(filePath, 'uri: !env PS_DATABASE_URI\n', 'utf8');

    expect(() => parseYamlFile(filePath)).toThrow(/PS_DATABASE_URI/);
    expect(() => parseYamlFile(filePath)).toThrow(/undefined/);
  });

  it('substitutes the environment variable when it is set', () => {
    process.env.PS_DATABASE_URI = 'postgresql://repro:repro@db.example.invalid:5432/postgres';
    const filePath = join(tmpDir, 'service.yaml');
    writeFileSync(filePath, 'uri: !env PS_DATABASE_URI\n', 'utf8');

    expect(parseYamlFile(filePath).contents?.toJSON()).toEqual({
      uri: 'postgresql://repro:repro@db.example.invalid:5432/postgres'
    });
  });
});
