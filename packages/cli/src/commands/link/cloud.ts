import { Flags } from '@oclif/core';

import { writeCloudLink } from '../../api/write-cloud-link.js';
import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';
import { ensureServiceTypeMatches } from '../../utils/ensureServiceType.js';
import { LINK_FILENAME } from '../../utils/project-config.js';

export default class LinkCloud extends CloudInstanceCommand {
  static description = 'Link this directory to a PowerSync Cloud instance.';
  static summary = 'Link to PowerSync Cloud (instance ID, org, project).';
  static flags = {
    ...CloudInstanceCommand.flags,
    /**
     * TODO, we could default some of these to the values used after login
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

    const projectDir = this.ensureProjectDirExists({ directory });
    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: 'cloud',
      projectDir
    });

    writeCloudLink(projectDir, { instanceId, orgId, projectId });
    this.log(`Updated ${directory}/${LINK_FILENAME} with Cloud instance link.`);
  }
}
