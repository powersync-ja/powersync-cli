import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface LoadedYaml {
  path: string;
  contents: string;
  sha256: string;
}

export async function loadYaml(file: string): Promise<LoadedYaml> {
  const abs = resolve(file);
  const contents = await readFile(abs, 'utf8');
  const sha256 = createHash('sha256').update(contents).digest('hex');
  return { path: abs, contents, sha256 };
}
