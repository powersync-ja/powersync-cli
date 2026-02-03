import { Command, Flags } from '@oclif/core';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';

import { commonFlags } from '../../utils/flags.js';

const LINK_FILENAME = 'link.yaml';

export default class LinkCloud extends Command {
  static description = 'Link this directory to a PowerSync Cloud instance.';
  static summary = 'Link to PowerSync Cloud (instance ID, org, project).';
  static enableStrictArgs = true;

  static flags = {
    ...commonFlags,
    'instance-id': Flags.string({
      description: 'PowerSync Cloud instance ID.',
      required: true
    }),
    'org-id': Flags.string({
      description: 'Organization ID.',
      required: true
    }),
    'project-id': Flags.string({
      description: 'Project ID.',
      required: true
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkCloud);
    const { directory, 'instance-id': instanceId, 'org-id': orgId, 'project-id': projectId } = flags;

    const projectDir = join(process.cwd(), directory);
    if (!existsSync(projectDir)) {
      this.error(`Directory "${directory}" not found. Run \`powersync init\` first to create the project.`, {
        exit: 1
      });
    }

    const linkPath = join(projectDir, LINK_FILENAME);
    const config = {
      type: 'cloud' as const,
      instance_id: instanceId,
      org_id: orgId,
      project_id: projectId
    };
    writeFileSync(linkPath, stringifyYaml(config), 'utf8');
    this.log(`Updated ${directory}/${LINK_FILENAME} with Cloud instance link.`);
  }
}
