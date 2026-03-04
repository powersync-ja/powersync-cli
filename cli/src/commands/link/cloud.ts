import { Flags, ux } from '@oclif/core';
import {
  CLI_FILENAME,
  CloudInstanceCommand,
  CommandHelpGroup,
  ensureServiceTypeMatches,
  env,
  getDefaultOrgId,
  InstanceCommand,
  ServiceType
} from '@powersync/cli-core';

import { createCloudInstance } from '../../api/cloud/create-cloud-instance.js';
import { validateCloudLinkConfig } from '../../api/cloud/validate-cloud-link-config.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';

export default class LinkCloud extends CloudInstanceCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description =
    'Write or update cli.yaml with a Cloud instance (instance-id, org-id, project-id). Use --create to create a new instance from service.yaml name/region and link it; omit --instance-id when using --create. Org ID is optional when the token has a single organization.';
  static examples = [
    '<%= config.bin %> <%= command.id %> --project-id=<project-id>',
    '<%= config.bin %> <%= command.id %> --create --project-id=<project-id>',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<project-id> --org-id=<org-id>'
  ];
  static flags = {
    create: Flags.boolean({
      default: false,
      description:
        'Create a new Cloud instance in the given org and project, then link. Do not supply --instance-id when using --create.'
    }),
    'instance-id': Flags.string({
      default: env.INSTANCE_ID,
      description: 'PowerSync Cloud instance ID. Omit when using --create. Resolved: flag → INSTANCE_ID → cli.yaml.',
      required: false
    }),
    'org-id': Flags.string({
      default: env.ORG_ID,
      description:
        'Organization ID. Optional when the token has a single org; required when the token has multiple orgs. Resolved: flag → ORG_ID → cli.yaml.',
      required: false
    }),
    'project-id': Flags.string({
      default: env.PROJECT_ID,
      description: 'Project ID. Resolved: flag → PROJECT_ID → cli.yaml.',
      required: true
    }),
    ...InstanceCommand.flags
  };
  static summary = '[Cloud only] Link to a PowerSync Cloud instance (or create one with --create).';

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkCloud);
    let { create, directory, 'instance-id': instanceId, 'org-id': orgId, 'project-id': projectId } = flags;

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

      try {
        await validateCloudLinkConfig({
          cloudClient: this.client,
          input: { orgId, projectId },
          validateInstance: false
        });
      } catch (error) {
        this.styledError({ message: error instanceof Error ? error.message : String(error) });
      }

      const config = this.parseConfig(projectDirectory);
      const { client } = this;

      let newInstanceId: string;
      try {
        const result = await createCloudInstance(client, {
          name: config.name,
          orgId,
          projectId,
          region: config.region
        });
        newInstanceId = result.instanceId;
      } catch (error) {
        this.styledError({ error, message: 'Failed to create Cloud instance' });
      }

      ensureServiceTypeMatches({
        command: this,
        configRequired: false,
        directoryLabel: directory,
        expectedType: ServiceType.CLOUD,
        projectDir: projectDirectory
      });
      writeCloudLink(projectDirectory, { instanceId: newInstanceId, orgId, projectId });
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

    try {
      await validateCloudLinkConfig({
        cloudClient: this.client,
        input: { instanceId, orgId, projectId },
        validateInstance: true
      });
    } catch (error) {
      this.styledError({ message: error instanceof Error ? error.message : String(error) });
    }

    writeCloudLink(projectDirectory, { instanceId, orgId, projectId });
    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: ServiceType.CLOUD,
      projectDir: projectDirectory
    });
    this.log(ux.colorize('green', `Updated ${directory}/${CLI_FILENAME} with Cloud instance link.`));
  }
}
