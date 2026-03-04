import { ux } from '@oclif/core';
import {
  CLI_FILENAME,
  SERVICE_FILENAME,
  SYNC_FILENAME,
  YAML_CLI_SCHEMA,
  YAML_SERVICE_SCHEMA,
  YAML_SYNC_RULES_SCHEMA
} from '@powersync/cli-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const VSCODE_YAML_TAGS = ['!env scalar'];

/** Maps each known config filename to its yaml-language-server schema comment. */
const YAML_SCHEMA_COMMENTS: Record<string, string> = {
  [CLI_FILENAME]: YAML_CLI_SCHEMA,
  [SERVICE_FILENAME]: YAML_SERVICE_SCHEMA,
  [SYNC_FILENAME]: YAML_SYNC_RULES_SCHEMA
};

/**
 * A pluggable function signature for configuring a specific IDE.
 * Receives the workspace root (for IDE settings), the list of discovered project
 * directories to scan, and a log callback for producing output.
 */
export type IdeConfigurator = (workspaceRoot: string, projectDirs: string[], log: (message: string) => void) => void;

/**
 * Configures the VSCode workspace for PowerSync YAML editing and prints guidance:
 *   - Writes/merges .vscode/settings.json with yaml.customTags so the !env tag is recognised.
 *   - Scans each projectDir for known config files and prepends a yaml-language-server schema
 *     comment to any file that does not already have one.
 *   - Prints a summary of changes, extension recommendation, and schema comment reference.
 */
export function configureVscodeIde(workspaceRoot: string, projectDirs: string[], log: (message: string) => void): void {
  const vscodeDir = join(workspaceRoot, '.vscode');
  const settingsPath = join(vscodeDir, 'settings.json');

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, 'utf8');
      settings = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // If invalid JSON, overwrite with our settings.
    }
  }

  const currentTags = (settings['yaml.customTags'] ?? []) as string[];
  settings['yaml.customTags'] = [...new Set([...currentTags, ...VSCODE_YAML_TAGS])];
  mkdirSync(vscodeDir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  const filesUpdated: string[] = [];

  for (const projectDir of projectDirs) {
    for (const [filename, schemaComment] of Object.entries(YAML_SCHEMA_COMMENTS)) {
      const filePath = join(projectDir, filename);
      if (!existsSync(filePath)) continue;

      const content = readFileSync(filePath, 'utf8');
      if (!content.includes('yaml-language-server:')) {
        writeFileSync(filePath, `${schemaComment}\n\n${content}`);
        filesUpdated.push(filePath);
      }
    }
  }

  const lines: string[] = [
    ux.colorize('green', 'VSCode configured for PowerSync YAML editing!'),
    '',
    `✔ Updated .vscode/settings.json with yaml.customTags: ${JSON.stringify(VSCODE_YAML_TAGS)}`
  ];

  if (filesUpdated.length > 0) {
    lines.push('', 'Added yaml-language-server schema comments to:');
    for (const f of filesUpdated) {
      lines.push(`  ✔ ${f}`);
    }
  }

  lines.push(
    '',
    ux.colorize('cyan', 'Recommended: Install the YAML extension'),
    'Install the Red Hat YAML extension for VSCode to get schema validation and autocompletion:',
    ux.colorize('blue', '  https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml'),
    '',
    ux.colorize('cyan', 'Language server schema comments'),
    'The following comments at the top of each YAML config file activate schema support.',
    'They are added automatically when you run powersync init, but you can also add them manually:',
    '',
    ux.colorize('dim', '# service.yaml'),
    ux.colorize('gray', YAML_SERVICE_SCHEMA),
    '',
    ux.colorize('dim', '# sync-config.yaml'),
    ux.colorize('gray', YAML_SYNC_RULES_SCHEMA),
    '',
    ux.colorize('dim', '# cli.yaml'),
    ux.colorize('gray', YAML_CLI_SCHEMA)
  );

  log(lines.join('\n'));
}
