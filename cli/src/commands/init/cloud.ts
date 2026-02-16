import { ux } from '@oclif/core';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InstanceCommand, PowerSyncCommand } from '@powersync/cli-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'templates');

export default class InitCloud extends PowerSyncCommand {
  static description =
    'Copy a Cloud template into a config directory (default powersync/). Edit service.yaml then run link cloud and deploy.';
  static summary = 'Scaffold a PowerSync Cloud config directory from a template.';
  static flags = {
    ...InstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InitCloud);
    const { directory } = flags;
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

    const instructions = [
      'Create a new instance with ',
      ux.colorize('blue', 'powersync link cloud --create'),
      'or update this project with an existing instance by running',
      ux.colorize('blue', 'powersync pull config'),
      'Then run',
      ux.colorize('blue', 'powersync deploy'),
      'to deploy.'
    ].join('\n');

    this.log(
      [
        ux.colorize('green', 'Created PowerSync cloud project!'),
        '',
        ux.colorize('cyan', 'Configuration files are located in:'),
        ux.colorize('gray', targetDir),
        '',
        ux.colorize('yellow', instructions)
      ].join('\n')
    );
  }
}
