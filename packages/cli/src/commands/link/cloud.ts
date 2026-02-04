import { Flags } from '@oclif/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';
import { ensureServiceTypeMatches } from '../../utils/ensureServiceType.js';
import { LINK_FILENAME, loadLinkDocument } from '../../utils/project-config.js';

export default class LinkCloud extends CloudInstanceCommand {
  static description = 'Link this directory to a PowerSync Cloud instance.';
  static summary = 'Link to PowerSync Cloud (instance ID, org, project).';
  static flags = {
    ...CloudInstanceCommand.flags,
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

    // We don't require having the cloud condig in service.yaml for all commands
    const projectDir = this.ensureProjectDirExists({ directory });
    ensureServiceTypeMatches(this, projectDir, 'cloud', directory, false);

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
