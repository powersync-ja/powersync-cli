import { Flags, ux } from '@oclif/core';
import {
  CLI_FILENAME,
  CloudInstanceCommand,
  CommandHelpGroup,
  ensureServiceTypeMatches,
  env,
  getDefaultOrgId,
  ServiceType
} from '@powersync/cli-core';

import { createCloudInstance } from '../../api/cloud/create-cloud-instance.js';
import { validateCloudLinkConfig } from '../../api/cloud/validate-cloud-link-config.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';

export default class LinkCloud extends CloudInstanceCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description =
    'Write or update cli.yaml with a Cloud instance link. Pass --instance-id to link an existing instance (org-id and project-id are resolved automatically). Use --create with --project-id to create a new instance from service.yaml and link it.';
  static examples = [
    '<%= config.bin %> <%= command.id %> --instance-id=<id>',
    '<%= config.bin %> <%= command.id %> --create --project-id=<project-id>',
    '<%= config.bin %> <%= command.id %> --create --project-id=<project-id> --org-id=<org-id>'
  ];
  static flags = {
    create: Flags.boolean({
      default: false,
      description:
        'Create a new Cloud instance in the given org and project, then link. Do not supply --instance-id when using --create.'
    }),
    'instance-id': Flags.string({
      default: env.INSTANCE_ID,
      description: 'PowerSync Cloud instance ID. Omit when using --create. Resolved: flag → INSTANCE_ID.',
      required: false
    }),
    'org-id': Flags.string({
      default: env.ORG_ID,
      description:
        'Organization ID. Auto-resolved from the instance when linking an existing instance; required (or auto-resolved if single org) when using --create. Resolved: flag → ORG_ID.',
      required: false
    }),
    'project-id': Flags.string({
      default: env.PROJECT_ID,
      description:
        'Project ID. Required when using --create; auto-resolved from the instance otherwise. Resolved: flag → PROJECT_ID.',
      required: false
    })
  };
  static summary = '[Cloud only] Link to a PowerSync Cloud instance (or create one with --create).';

  async run(): Promise<void> {
    const { flags } = await this.parse(LinkCloud);
    let { create, directory, 'instance-id': instanceId, 'org-id': orgId, 'project-id': projectId } = flags;

    const projectDirectory = this.resolveProjectDir(flags);
    if (create) {
      if (instanceId) {
        this.styledError({
          message: 'Do not supply --instance-id when using --create. The instance will be created and linked.'
        });
      }

      if (!projectId) {
        this.styledError({
          message: 'Pass --project-id when using --create.'
        });
      }

      if (!orgId) {
        orgId = await getDefaultOrgId();
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

      const config = this.parseLocalConfig(projectDirectory);
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
      const instanceMeta = await this.client.getInstance({ id: instanceId });
      orgId = instanceMeta.org_id;
      projectId = instanceMeta.app_id;
    } catch {
      this.styledError({
        message: `Instance ${instanceId} was not found, or is not accessible with the current token.`
      });
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
