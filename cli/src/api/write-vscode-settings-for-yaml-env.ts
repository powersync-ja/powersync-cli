import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VSCODE_YAML_TAGS = ['!env scalar'];

/**
 * Writes or merges .vscode/settings.json in the workspace root so that YAML files
 * get proper schema support for the !env custom tag.
 */
export function writeVscodeSettingsForYamlEnv(workspaceRoot: string): void {
  const vscodeDir = join(workspaceRoot, '.vscode');
  const settingsPath = join(vscodeDir, 'settings.json');

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // If invalid JSON, overwrite with our settings
    }
  }

  const currentSettings = (settings['yaml.customTags'] ?? []) as string[];
  const mergedTags = Array.from(new Set([...currentSettings, ...VSCODE_YAML_TAGS]));
  settings['yaml.customTags'] = mergedTags;
  mkdirSync(vscodeDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}
