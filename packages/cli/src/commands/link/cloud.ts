import { Flags } from '@oclif/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { InstanceCommand } from '../../command-types/InstanceCommand.js';
import { loadLinkDocument } from '../../utils/loadLinkDoc.js';

const LINK_FILENAME = 'link.yaml';

export default class LinkCloud extends InstanceCommand {
  static description = 'Link this directory to a PowerSync Cloud instance.';
  static summary = 'Link to PowerSync Cloud (instance ID, org, project).';
  static flags = {
    ...InstanceCommand.flags,
    /**
     * TODO, we could default these to the values used after login
     */
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

    const projectDir = this.ensureProjectDirExists(directory);

    const linkPath = join(projectDir, LINK_FILENAME);
    const doc = loadLinkDocument(linkPath);
    doc.set('type', 'cloud');
    doc.set('instance_id', instanceId);
    doc.set('org_id', orgId);
    doc.set('project_id', projectId);
    writeFileSync(linkPath, doc.toString(), 'utf8');
    this.log(`Updated ${directory}/${LINK_FILENAME} with Cloud instance link.`);
  }
}
