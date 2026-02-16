import { ux } from '@oclif/core';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InstanceCommand, PowerSyncCommand, SERVICE_FILENAME } from '@powersync/cli-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'templates');

export default class InitSelfHosted extends PowerSyncCommand {
  static description =
    'Copy a self-hosted template into a config directory (default powersync/). Configure service.yaml with your self-hosted instance details.';
  static summary = 'Scaffold a PowerSync self-hosted config directory from a template.';
  static flags = {
    ...InstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(InitSelfHosted);
    const { directory } = flags;
    const targetDir = this.resolveProjectDir(flags);

    if (existsSync(targetDir)) {
      this.styledError({
        message: `Directory "${directory}" already exists. Delete the folder to start over, or link existing config with ${ux.colorize('blue', 'powersync link self-hosted')}.`
      });
    }

    const templatePath = join(TEMPLATES_DIR, 'self-hosted', 'base', 'powersync');
    if (!existsSync(templatePath)) {
      this.styledError({
        message: `Template not found for self-hosted at ${templatePath}`
      });
    }

    mkdirSync(targetDir, { recursive: true });
    cpSync(templatePath, targetDir, { recursive: true });

    const instructions = [
      'Self Hosted projects currently require external configuration for starting and deploying.',
      `Configure the ${SERVICE_FILENAME} file with your self-hosted instance details.`,
      `See the Docker topic, with ${ux.colorize('blue', 'powersync docker --help')} for local development services.`,
      'Please refer to the PowerSync Self-Hosted documentation for more information.'
    ].join('\n');

    this.log(
      [
        ux.colorize('green', 'Created PowerSync self-hosted project!'),
        '',
        ux.colorize('gray', 'Configuration files are located in:'),
        ux.colorize('cyan', targetDir),
        '',
        ux.colorize('yellow', instructions)
      ].join('\n')
    );
  }
}
