import { Flags } from '@oclif/core';

import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';
import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';
import { InstanceCommand } from '../../command-types/InstanceCommand.js';
import { ensureServiceTypeMatches } from '../../utils/ensureServiceType.js';
import { env } from '../../utils/env.js';
import { LINK_FILENAME } from '../../utils/project-config.js';

export default class LinkCloud extends CloudInstanceCommand {
  static description = 'Link this directory to a PowerSync Cloud instance.';
  static summary = 'Link to PowerSync Cloud (instance ID, org, project).';
  static flags = {
    // These are required for the linking command
    'instance-id': Flags.string({
      description: 'PowerSync Cloud instance ID.',
      default: env.INSTANCE_ID,
      required: true
    }),
    'org-id': Flags.string({
      description: 'Organization ID.',
      default: env.ORG_ID,
      required: true
    }),
    'project-id': Flags.string({
      description: 'Project ID.',
      default: env.PROJECT_ID,
      required: true
    }),
    ...InstanceCommand.flags
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
