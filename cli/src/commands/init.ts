import { Flags } from '@oclif/core';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InstanceCommand } from '../command-types/InstanceCommand.js';
import { PowerSyncCommand } from '../command-types/PowerSyncCommand.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to templates (package root when running from dist/commands/ or src/commands/). */
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

export default class Init extends PowerSyncCommand {
  static description =
    'Copy a template into a config directory (default powersync/). Use --type=cloud or --type=self-hosted. For Cloud, edit service.yaml then run link cloud and deploy.';
  static flags = {
    type: Flags.string({
      default: 'cloud',
      description: 'Type of PowerSync instance to scaffold (cloud or self-hosted).',
      options: ['cloud', 'self-hosted']
    }),
    ...InstanceCommand.flags
  };
  static summary = 'Scaffold a PowerSync config directory from a template.';

  async run(): Promise<void> {
    const { flags } = await this.parse(Init);
    const { directory, type } = flags;

    const targetDir = this.resolveProjectDir(flags);

    if (existsSync(targetDir)) {
      this.error(
        `Directory "${directory}" already exists. Delete the folder to start over, or link existing config to PowerSync Cloud with \`powersync link\`.`,
        { exit: 1 }
      );
    }

    const templateSubdir = type === 'cloud' ? 'cloud' : 'self-hosted/base';
    const templatePath = join(TEMPLATES_DIR, templateSubdir, 'powersync');

    if (!existsSync(templatePath)) {
      this.error(`Template not found for type "${type}" at ${templatePath}`, {
        exit: 1
      });
    }

    mkdirSync(targetDir, { recursive: true });
    cpSync(templatePath, targetDir, { recursive: true });

    const cloudInstructions = ['To deploy to PowerSync Cloud, run:', 'powersync link cloud', 'powersync deploy'].join(
      '\n'
    );

    const selfHostedInstructions = [
      'Self Hosted projects currently require external configuration for starting and deploying.',
      'Please refer to the PowerSync Self-Hosted documentation for more information.'
    ].join('\n');

    const instructions = type === 'cloud' ? cloudInstructions : selfHostedInstructions;
    this.log(
      [`Created PowerSync ${type} project!`, 'Configuration files are located in:', targetDir, '', instructions].join(
        '\n'
      )
    );
  }
}
