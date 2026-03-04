import { select } from '@inquirer/prompts';
import { ux } from '@oclif/core';
import { CLI_FILENAME, CommandHelpGroup, parseYamlFile, PowerSyncCommand } from '@powersync/cli-core';
import { CLIConfig } from '@powersync/cli-schemas';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { configureVscodeIde, type IdeConfigurator } from '../../api/ide/configure-vscode-ide.js';

const IDE_CONFIGURATORS: Record<string, IdeConfigurator> = {
  vscode: configureVscodeIde
};

/**
 * Scans the current working directory for subdirectories that contain a valid
 * PowerSync cli.yaml. Returns their absolute paths.
 */
function findLinkedProjectDirs(cwd: string): string[] {
  const projectDirs: string[] = [];

  for (const entry of readdirSync(cwd)) {
    const entryPath = join(cwd, entry);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }

    try {
      const doc = parseYamlFile(join(entryPath, CLI_FILENAME));
      CLIConfig.decode(doc.contents?.toJSON());
      projectDirs.push(entryPath);
    } catch {
      // Not a valid PowerSync project — skip.
    }
  }

  return projectDirs;
}

export default class ConfigureIde extends PowerSyncCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description =
    'Configure or guide your IDE setup for the best PowerSync CLI developer experience. Enables YAML schema validation and autocompletion, sets up !env custom tag support, and patches existing config files with language server directives.';
  static examples = ['<%= config.bin %> <%= command.id %>'];
  static summary = 'Configure your IDE for the best PowerSync CLI developer experience.';

  async run(): Promise<void> {
    await this.parse(ConfigureIde);

    this.log(
      `Tip: use ${ux.colorize('blue', 'powersync edit config')} for a complete in-browser editing experience.\n`
    );

    const ide = await select({
      choices: [
        { name: 'VSCode', value: 'vscode' },
        { name: 'Exit', value: 'exit' }
      ],
      message: 'Select your IDE to configure (only VSCode is supported for now):'
    });

    if (ide === 'exit') return;

    const projectDirs = findLinkedProjectDirs(process.cwd());
    const configurator = IDE_CONFIGURATORS[ide];
    configurator(process.cwd(), projectDirs, (msg) => this.log(msg));
  }
}
