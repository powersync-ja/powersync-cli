import { Command, Flags } from '@oclif/core';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

import { commonFlags } from '../../utils/flags.js';

const LINK_FILENAME = 'link.yaml';

export default class LinkSelfHosted extends Command {
  static description = 'Link this directory to a self-hosted PowerSync instance.';
  static summary = 'Link to self-hosted PowerSync (API URL and token).';
  static enableStrictArgs = true;

  static flags = {
    ...commonFlags,
    url: Flags.string({
      description: 'Self-hosted PowerSync API base URL (e.g. https://powersync.example.com).',
      required: true
    }),
    'api-key': Flags.string({
      description: 'API key / token for the self-hosted instance.',
      required: true
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkSelfHosted);
    const { directory, url, 'api-key': apiKey } = flags;

    const projectDir = join(process.cwd(), directory);
    if (!existsSync(projectDir)) {
      this.error(`Directory "${directory}" not found. Run \`powersync init\` first to create the project.`, {
        exit: 1
      });
    }

    const linkPath = join(projectDir, LINK_FILENAME);
    const config = {
      type: 'self-hosted' as const,
      api_url: url,
      api_key: apiKey
    };
    writeFileSync(linkPath, stringifyYaml(config), 'utf8');
    this.log(`Updated ${directory}/${LINK_FILENAME} with self-hosted link.`);
  }
}
