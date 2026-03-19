import { input } from '@inquirer/prompts';
import { Flags, ux } from '@oclif/core';
import {
  CLI_FILENAME,
  CommandHelpGroup,
  ensureServiceTypeMatches,
  env,
  parseYamlFile,
  SelfHostedInstanceCommand,
  ServiceType
} from '@powersync/cli-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Document } from 'yaml';

export default class LinkSelfHosted extends SelfHostedInstanceCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description = [
    `Links a self hosted PowerSync instance by API URL.`,
    `API Keys can be specified via input or specified in the PS_ADMIN_TOKEN environment variable.`
  ].join('\n');
  static examples = ['<%= config.bin %> <%= command.id %> --api-url=https://powersync.example.com'];
  static flags = {
    'api-url': Flags.string({
      description: 'Self-hosted PowerSync API base URL (e.g. https://powersync.example.com).',
      required: true
    })
  };
  static summary = 'Link to a self-hosted PowerSync instance by API URL.';

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkSelfHosted);
    const { 'api-url': apiUrl, directory } = flags;

    const projectDir = this.resolveProjectDir(flags);
    if (!existsSync(projectDir)) {
      mkdirSync(projectDir, { recursive: true });
    }

    const defaultApiKey = '!env PS_ADMIN_TOKEN';

    // If running non-interactively, default to !env PS_ADMIN_TOKEN instead of prompting.
    const shouldPromptForApiKey = !env.PS_ADMIN_TOKEN && Boolean(process.stdin.isTTY);
    const apiKey = shouldPromptForApiKey
      ? await input({
          default: '!env PS_ADMIN_TOKEN',
          message: 'API key (default: !env PS_ADMIN_TOKEN — read from PS_ADMIN_TOKEN when running commands):'
        })
      : defaultApiKey;

    // Preserve comments
    const linkPath = join(projectDir, CLI_FILENAME);
    const doc = existsSync(linkPath) ? parseYamlFile(linkPath) : new Document();
    doc.set('type', 'self-hosted');
    doc.set('api_url', apiUrl);
    doc.set('api_key', apiKey.trim() || '!env PS_ADMIN_TOKEN');
    writeFileSync(linkPath, doc.toString(), 'utf8');

    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: ServiceType.SELF_HOSTED,
      projectDir
    });

    this.log(ux.colorize('green', `Updated ${directory}/${CLI_FILENAME} with self-hosted link.`));
  }
}
