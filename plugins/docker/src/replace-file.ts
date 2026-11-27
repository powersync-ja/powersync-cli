import { randomUUID } from 'node:crypto';
import { renameSync, statSync, writeFileSync } from 'node:fs';

export function replaceFile(path: string, contents: string, mode = statSync(path).mode) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporary, contents, { flag: 'wx', mode });
  renameSync(temporary, path);
}
