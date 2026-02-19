import { Flags, ux } from '@oclif/core';

import {
  CLI_FILENAME,
  CloudInstanceCommand,
  ensureServiceTypeMatches,
  env,
  getDefaultOrgId,
  InstanceCommand,
  ServiceType
} from '@powersync/cli-core';
import { createCloudInstance } from '../../api/cloud/create-cloud-instance.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';

export default class LinkCloud extends CloudInstanceCommand {
  static description =
    'Write or update cli.yaml with a Cloud instance (instance-id, org-id, project-id). Use --create to create a new instance from service.yaml name/region and link it; omit --instance-id when using --create. Org ID is optional when the token has a single organization.';
  static summary = 'Link to a PowerSync Cloud instance (or create one with --create).';
  static flags = {
    create: Flags.boolean({
      description:
        'Create a new Cloud instance in the given org and project, then link. Do not supply --instance-id when using --create.',
      default: false
    }),
    'instance-id': Flags.string({
      description: 'PowerSync Cloud instance ID. Omit when using --create. Resolved: flag → INSTANCE_ID → cli.yaml.',
      default: env.INSTANCE_ID,
      required: false
    }),
    'org-id': Flags.string({
      description:
        'Organization ID. Optional when the token has a single org; required when the token has multiple orgs. Resolved: flag → ORG_ID → cli.yaml.',
      default: env.ORG_ID,
      required: false
    }),
    'project-id': Flags.string({
      description: 'Project ID. Resolved: flag → PROJECT_ID → cli.yaml.',
      default: env.PROJECT_ID,
      required: true
    }),
    ...InstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkCloud);
    let { directory, create, 'instance-id': instanceId, 'org-id': orgId, 'project-id': projectId } = flags;

    if (!orgId) {
      orgId = await getDefaultOrgId();
    }

    const projectDirectory = this.resolveProjectDir(flags);
    if (create) {
      if (instanceId) {
        this.styledError({
          message: 'Do not supply --instance-id when using --create. The instance will be created and linked.'
        });
      }
      const config = this.parseConfig(projectDirectory);
      const { client } = this;

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
        this.styledError({ message: 'Failed to create Cloud instance', error });
      }
      const projectDir = this.ensureProjectDirExists({ directory });
      ensureServiceTypeMatches({
        command: this,
        configRequired: false,
        directoryLabel: directory,
        expectedType: ServiceType.CLOUD,
        projectDir
      });
      writeCloudLink(projectDir, { instanceId: newInstanceId, orgId, projectId });
      this.log(
        ux.colorize('green', `Created Cloud instance ${newInstanceId} and updated ${directory}/${CLI_FILENAME}.`)
      );
      return;
    }

    if (!instanceId) {
      this.styledError({
        message:
          'Linking requires an instance ID. Supply --instance-id (or use --create to create a new instance and link).'
      });
    }

    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: ServiceType.CLOUD,
      projectDir: projectDirectory
    });

    writeCloudLink(projectDirectory, { instanceId, orgId, projectId });
    this.log(ux.colorize('green', `Updated ${directory}/${CLI_FILENAME} with Cloud instance link.`));
  }
}
