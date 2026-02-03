import { Flags } from '@oclif/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { InstanceCommand } from '../../command-types/InstanceCommand.js';
import { loadLinkDocument } from '../../utils/loadLinkDoc.js';

const LINK_FILENAME = 'link.yaml';

export default class LinkSelfHosted extends InstanceCommand {
  static description = 'Link this directory to a self-hosted PowerSync instance.';
  static summary = 'Link to self-hosted PowerSync (API URL and token).';
  static flags = {
    ...InstanceCommand.flags,
    url: Flags.string({
      description: 'Self-hosted PowerSync API base URL (e.g. https://powersync.example.com).',
      required: true
    }),
    'api-key': Flags.string({
      description: 'API key / token for the self-hosted instance.',
      default: '!env POWERSYNC_API_KEY'
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkSelfHosted);
    const { directory, url, 'api-key': apiKey } = flags;

    const projectDir = this.ensureProjectDirExists(directory);

    const linkPath = join(projectDir, LINK_FILENAME);
    const doc = loadLinkDocument(linkPath);
    doc.set('type', 'self-hosted');
    doc.set('api_url', url);
    doc.set('api_key', apiKey);
    writeFileSync(linkPath, doc.toString(), 'utf8');
    this.log(`Updated ${directory}/${LINK_FILENAME} with self-hosted link.`);
  }
}
