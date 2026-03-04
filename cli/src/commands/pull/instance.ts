import { ux } from '@oclif/core';
import {
  CLI_FILENAME,
  CloudInstanceCommand,
  CommandHelpGroup,
  ensureServiceTypeMatches,
  getDefaultOrgId,
  SERVICE_FILENAME,
  ServiceType,
  SYNC_FILENAME
} from '@powersync/cli-core';
import { ServiceCloudConfig } from '@powersync/cli-schemas';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stringify } from 'yaml';

import { decodeFetchedCloudConfig } from '../../api/cloud/fetch-cloud-config.js';
import { validateCloudLinkConfig } from '../../api/cloud/validate-cloud-link-config.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';

const SERVICE_FETCHED_FILENAME = 'service-fetched.yaml';
const SYNC_FETCHED_FILENAME = 'sync-fetched.yaml';

const PULL_CONFIG_HEADER = `# PowerSync Cloud config (fetched from cloud)
# yaml-language-server: $schema=https://unpkg.com/@powersync/cli-schemas@latest/json-schema/service-config.json
#
`;

export default class PullInstance extends CloudInstanceCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description =
    'Fetch an existing Cloud instance by ID: create the config directory if needed, write cli.yaml, and download service.yaml and sync-config.yaml. Pass --instance-id and --project-id when the directory is not yet linked; --org-id is optional when the token has a single organization. Cloud only.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<id>',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<id> --org-id=<org-id>'
  ];
  static flags = {
    ...CloudInstanceCommand.flags
  };
  static summary =
    '[Cloud only] Pull an existing Cloud instance: link and download config into local service.yaml and sync-config.yaml.';

  async run(): Promise<void> {
    const { flags } = await this.parse(PullInstance);
    const { directory, 'instance-id': instanceId, 'org-id': _orgId, 'project-id': projectId } = flags;

    const resolvedOrgId = _orgId ?? (await getDefaultOrgId().catch(() => null));
    /**
     * The pull instance command can be used to create a new powersync project directory
     */
    const projectDir = this.resolveProjectDir(flags);
    if (!existsSync(projectDir)) {
      if (instanceId && resolvedOrgId && projectId) {
        mkdirSync(projectDir, { recursive: true });
      } else {
        this.styledError({
          message: `Directory "${directory}" not found. Pass --instance-id, and --project-id to create the config directory and link, or run this command from a directory that already contains a linked PowerSync config.`
        });
      }
    }

    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: ServiceType.CLOUD,
      projectDir
    });

    const linkPath = join(projectDir, CLI_FILENAME);
    if (!existsSync(linkPath)) {
      if (!instanceId || !resolvedOrgId || !projectId) {
        this.styledError({
          message: `Linking is required. Pass --instance-id, --org-id, and --project-id to this command, or run ${ux.colorize('blue', 'powersync link cloud --instance-id=<id> --org-id=<id> --project-id=<id>')} first.`
        });
      }

      writeCloudLink(projectDir, { instanceId, orgId: resolvedOrgId, projectId });
      this.log(`Created ${ux.colorize('blue', `${directory}/${CLI_FILENAME}`)} with Cloud instance link.`);
    }

    const { linked } = await this.loadProject(flags);

    let instanceConfig;
    try {
      const validationResult = await validateCloudLinkConfig({
        cloudClient: this.client,
        input: {
          instanceId: linked.instance_id,
          orgId: linked.org_id,
          projectId: linked.project_id
        },
        validateInstance: true
      });
      instanceConfig = validationResult.instanceConfig;
    } catch (error) {
      this.styledError({ message: error instanceof Error ? error.message : String(error) });
    }

    if (!instanceConfig) {
      this.styledError({
        message: `Instance ${linked.instance_id} was not found in project ${linked.project_id} in organization ${linked.org_id}, or is not accessible with the current token.`
      });
    }

    this.log(
      `Fetching config for instance ${ux.colorize('blue', linked.instance_id)} in project ${ux.colorize('blue', linked.project_id)} in org ${ux.colorize('blue', linked.org_id)}...`
    );

    const fetched = decodeFetchedCloudConfig(instanceConfig);

    const serviceExists = existsSync(join(projectDir, SERVICE_FILENAME));
    const syncExists = existsSync(join(projectDir, SYNC_FILENAME));
    if (serviceExists) {
      this.warn(
        `${ux.colorize('blue', SERVICE_FILENAME)} already exists. Writing to ${ux.colorize('blue', 'service-fetched.yaml')} instead. Manually merge the settings into ${ux.colorize('blue', SERVICE_FILENAME)} as needed.`
      );
    }

    if (syncExists && fetched.syncRules) {
      this.warn(
        `${ux.colorize('blue', SYNC_FILENAME)} already exists. Writing to ${ux.colorize('blue', 'sync-fetched.yaml')} instead. Manually merge the sync config into ${ux.colorize('blue', SYNC_FILENAME)} as needed.`
      );
    }

    const serviceYaml = PULL_CONFIG_HEADER + stringify(ServiceCloudConfig.encode(fetched.config));

    const serviceOutputName = serviceExists ? SERVICE_FETCHED_FILENAME : SERVICE_FILENAME;
    const serviceOutputPath = join(projectDir, serviceOutputName);
    this.log('');
    writeFileSync(serviceOutputPath, serviceYaml, 'utf8');
    this.log(`Wrote ${ux.colorize('blue', serviceOutputName)} with config from the cloud.`);

    if (typeof fetched.syncRules === 'string') {
      const syncOutputName = syncExists ? SYNC_FETCHED_FILENAME : SYNC_FILENAME;
      const syncOutputPath = join(projectDir, syncOutputName);
      writeFileSync(syncOutputPath, fetched.syncRules, 'utf8');
      this.log(`Wrote ${ux.colorize('blue', syncOutputName)} with sync config from the cloud.`);
    }
  }
}
