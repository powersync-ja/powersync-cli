import { Flags, ux } from '@oclif/core';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InstanceCommand, PowerSyncCommand } from '@powersync/cli-core';

import { writeVscodeSettingsForYamlEnv } from '../../api/write-vscode-settings-for-yaml-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'templates');

export default class InitCloud extends PowerSyncCommand {
  static description =
    'Copy a Cloud template into a config directory (default powersync/). Edit service.yaml then run link cloud and deploy.';
  static summary = 'Scaffold a PowerSync Cloud config directory from a template.';
  static flags = {
    ...InstanceCommand.flags,
    vscode: Flags.boolean({
      description: 'Configure the workspace with .vscode settings for YAML custom tags (!env).',
      default: false
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InitCloud);
    const { directory, vscode } = flags;
    const targetDir = this.resolveProjectDir(flags);

    if (existsSync(targetDir)) {
      this.styledError({
        message: `Directory "${directory}" already exists. Delete the folder to start over, or link existing config to PowerSync Cloud with ${ux.colorize('blue', 'powersync link')}.`
      });
    }

    const templatePath = join(TEMPLATES_DIR, 'cloud', 'powersync');
    if (!existsSync(templatePath)) {
      this.styledError({
        message: `Template not found for cloud at ${templatePath}`
      });
    }

    mkdirSync(targetDir, { recursive: true });
    cpSync(templatePath, targetDir, { recursive: true });

    if (vscode) {
      writeVscodeSettingsForYamlEnv(process.cwd());
    }

    const instructions = [
      'Create a new instance with ',
      ux.colorize('blue', '\tpowersync link cloud --create --org-id=<org-id> --project-id=<project-id>'),
      'or pull an existing instance with ',
      ux.colorize(
        'blue',
        '\tpowersync pull instance --org-id=<org-id> --project-id=<project-id> --instance-id=<instance-id>'
      ),
      'Then run',
      ux.colorize('blue', '\tpowersync deploy'),
      'to deploy changes.'
    ].join('\n');

    const lines = [
      ux.colorize('green', 'Created PowerSync cloud project!'),
      '',
      'Configuration files are located in:',
      `\t${targetDir}`,
      '',
      instructions
    ];
    if (vscode) {
      lines.splice(5, 0, 'Added .vscode/settings.json for YAML !env tag support.');
      lines.splice(6, 0, '');
    }
    this.log(lines.join('\n'));
  }
}
