import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SYNC_FILENAME } from './project-config.js';

export type ResolveSyncRulesContentOptions = {
  projectDirectory: string;
  /** When set, read sync rules from this file instead of `{projectDirectory}/sync-config.yaml`. */
  syncConfigFilePath?: string;
};

/**
 * Loads local sync rules YAML: optional explicit path, otherwise default file in the project directory.
 */
export function resolveSyncRulesContent(options: ResolveSyncRulesContentOptions): string | undefined {
  const { projectDirectory, syncConfigFilePath } = options;
  if (syncConfigFilePath) {
    return readFileSync(syncConfigFilePath, 'utf8');
  }
  const defaultPath = join(projectDirectory, SYNC_FILENAME);
  if (existsSync(defaultPath)) {
    return readFileSync(defaultPath, 'utf8');
  }
  return undefined;
}
