import { input } from '@inquirer/prompts';
import { Flags, ux } from '@oclif/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ensureServiceTypeMatches,
  env,
  InstanceCommand,
  CLI_FILENAME,
  parseYamlFile,
  SelfHostedInstanceCommand,
  ServiceType
} from '@powersync/cli-core';

export default class LinkSelfHosted extends SelfHostedInstanceCommand {
  static description = [
    `Links a self hosted PowerSync instance by API URL.`,
    `API Keys can be specified via input or specified in the TOKEN environment variable.`
  ].join('\n');
  static summary = 'Link to a self-hosted PowerSync instance by API URL.';
  static flags = {
    'api-url': Flags.string({
      description: 'Self-hosted PowerSync API base URL (e.g. https://powersync.example.com).',
      required: true
    }),
    ...InstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkSelfHosted);
    const { directory, 'api-url': apiUrl } = flags;

    const projectDir = this.ensureProjectDirExists(flags);
    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: ServiceType.SELF_HOSTED,
      projectDir
    });

    const defaultApiKey = '!env TOKEN';

    // If an environment variable is provided, then we should inject it at runtime.
    const apiKey = env.TOKEN
      ? defaultApiKey
      : await input({
          message: 'API key (default: !env TOKEN — read from TOKEN when running commands):',
          default: '!env TOKEN'
        });

    // Preserve comments
    const linkPath = join(projectDir, CLI_FILENAME);
    const doc = parseYamlFile(linkPath);
    doc.set('type', 'self-hosted');
    doc.set('api_url', apiUrl);
    doc.set('api_key', apiKey.trim() || '!env TOKEN');
    writeFileSync(linkPath, doc.toString(), 'utf8');

    this.log(ux.colorize('green', `Updated ${directory}/${CLI_FILENAME} with self-hosted link.`));
  }
}
