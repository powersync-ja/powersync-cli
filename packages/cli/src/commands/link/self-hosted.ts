import { input } from '@inquirer/prompts';
import { Flags } from '@oclif/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { InstanceCommand } from '../../command-types/InstanceCommand.js';
import { SelfHostedInstanceCommand } from '../../command-types/SelfHostedInstanceCommand.js';
import { ensureServiceTypeMatches } from '../../utils/ensureServiceType.js';
import { LINK_FILENAME, loadLinkDocument } from '../../utils/project-config.js';

export default class LinkSelfHosted extends SelfHostedInstanceCommand {
  static description = 'Link this directory to a self-hosted PowerSync instance.';
  static summary = 'Link to self-hosted PowerSync (API URL; API key from PS_TOKEN env).';
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
      expectedType: 'self-hosted',
      projectDir
    });

    const apiKey = await input({
      message: 'API key (default: !env PS_TOKEN — read from PS_TOKEN when running commands):',
      default: '!env PS_TOKEN'
    });

    const linkPath = join(projectDir, LINK_FILENAME);
    const doc = loadLinkDocument(linkPath);
    doc.set('type', 'self-hosted');
    doc.set('api_url', apiUrl);
    doc.set('api_key', apiKey.trim() || '!env PS_TOKEN');
    writeFileSync(linkPath, doc.toString(), 'utf8');
    this.log(`Updated ${directory}/${LINK_FILENAME} with self-hosted link.`);
  }
}
