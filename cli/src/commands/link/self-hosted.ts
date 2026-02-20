import { input } from '@inquirer/prompts';
import { Flags, ux } from '@oclif/core';
import {
  CLI_FILENAME,
  ensureServiceTypeMatches,
  env,
  InstanceCommand,
  parseYamlFile,
  SelfHostedInstanceCommand,
  ServiceType
} from '@powersync/cli-core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default class LinkSelfHosted extends SelfHostedInstanceCommand {
  static description = [
    `Links a self hosted PowerSync instance by API URL.`,
    `API Keys can be specified via input or specified in the TOKEN environment variable.`
  ].join('\n');
  static examples = [
    '<%= config.bin %> <%= command.id %> --api-url=https://powersync.example.com'
  ];
  static flags = {
    'api-url': Flags.string({
      description: 'Self-hosted PowerSync API base URL (e.g. https://powersync.example.com).',
      required: true
    }),
    ...InstanceCommand.flags
  };
  static summary = 'Link to a self-hosted PowerSync instance by API URL.';

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkSelfHosted);
    const { 'api-url': apiUrl, directory } = flags;

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
          default: '!env TOKEN',
          message: 'API key (default: !env TOKEN — read from TOKEN when running commands):'
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
