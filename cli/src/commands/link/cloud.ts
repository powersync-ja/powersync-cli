import { Flags, ux } from '@oclif/core';

import { createCloudInstance } from '../../api/cloud/create-cloud-instance.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';
import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';
import { InstanceCommand } from '../../command-types/InstanceCommand.js';
import { ensureServiceTypeMatches } from '../../utils/ensureServiceType.js';
import { env } from '../../utils/env.js';
import { LINK_FILENAME } from '../../utils/project-config.js';

export default class LinkCloud extends CloudInstanceCommand {
  static description =
    'Write or update link.yaml with a Cloud instance (instance-id, org-id, project-id). Use --create to create a new instance from service.yaml name/region and link it; omit --instance-id when using --create.';
  static summary = 'Link to a PowerSync Cloud instance (or create one with --create).';
  static flags = {
    create: Flags.boolean({
      description:
        'Create a new Cloud instance in the given org and project, then link. Do not supply --instance-id when using --create.',
      default: false
    }),
    'instance-id': Flags.string({
      description: 'PowerSync Cloud instance ID. Omit when using --create. Resolved: flag → INSTANCE_ID → link.yaml.',
      default: env.INSTANCE_ID,
      required: false
    }),
    'org-id': Flags.string({
      description: 'Organization ID. Resolved: flag → ORG_ID → link.yaml.',
      default: env.ORG_ID,
      required: true
    }),
    'project-id': Flags.string({
      description: 'Project ID. Resolved: flag → PROJECT_ID → link.yaml.',
      default: env.PROJECT_ID,
      required: true
    }),
    ...InstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkCloud);
    const { directory, create, 'instance-id': instanceId, 'org-id': orgId, 'project-id': projectId } = flags;

    const project = this.loadProject(flags, { configFileRequired: false, linkingIsRequired: false });
    if (create) {
      if (instanceId) {
        this.error('Do not supply --instance-id when using --create. The instance will be created and linked.', {
          exit: 1
        });
      }
      const config = this.parseConfig(project.projectDirectory);
      const client = await this.getClient();
      let newInstanceId: string;
      try {
        const result = await createCloudInstance(client, {
          orgId,
          projectId,
          name: config.name,
          region: config.region
        });
        newInstanceId = result.instanceId;
      } catch (error) {
        this.error(`Failed to create Cloud instance: ${error}`, { exit: 1 });
      }
      const projectDir = this.ensureProjectDirExists({ directory });
      ensureServiceTypeMatches({
        command: this,
        configRequired: false,
        directoryLabel: directory,
        expectedType: 'cloud',
        projectDir
      });
      writeCloudLink(projectDir, { instanceId: newInstanceId, orgId, projectId });
      this.log(
        ux.colorize('green', `Created Cloud instance ${newInstanceId} and updated ${directory}/${LINK_FILENAME}.`)
      );
      return;
    }

    if (!instanceId) {
      this.error(
        'Linking requires an instance ID. Supply --instance-id (or use --create to create a new instance and link).',
        { exit: 1 }
      );
    }

    const projectDir = this.ensureProjectDirExists({ directory });
    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: 'cloud',
      projectDir
    });

    writeCloudLink(projectDir, { instanceId, orgId, projectId });
    this.log(ux.colorize('green', `Updated ${directory}/${LINK_FILENAME} with Cloud instance link.`));
  }
}
