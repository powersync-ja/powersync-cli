import { ux } from '@oclif/core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLI_FILENAME,
  CloudInstanceCommand,
  ensureServiceTypeMatches,
  SERVICE_FILENAME,
  ServiceType,
  SYNC_FILENAME
} from '@powersync/cli-core';
import { ServiceCloudConfig } from '@powersync/cli-schemas';
import { stringify } from 'yaml';
import { fetchCloudConfig } from '../../api/cloud/fetch-cloud-config.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';

const SERVICE_FETCHED_FILENAME = 'service-fetched.yaml';
const SYNC_FETCHED_FILENAME = 'sync-fetched.yaml';

const PULL_CONFIG_HEADER = `# PowerSync Cloud config (fetched from cloud)
# yaml-language-server: $schema=https://unpkg.com/@powersync/cli-schemas@latest/json-schema/service-config.json
#
`;

export default class PullInstance extends CloudInstanceCommand {
  static description =
    'Fetch an existing Cloud instance by ID: create the config directory if needed, write cli.yaml, and download service.yaml and sync.yaml. Pass --instance-id, --org-id, and --project-id when the directory is not yet linked. Cloud only.';
  static summary = 'Pull an existing Cloud instance: link and download config into local service.yaml and sync.yaml.';

  static flags = {
    ...CloudInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PullInstance);
    const { directory, 'instance-id': instanceId, 'org-id': orgId, 'project-id': projectId } = flags;

    /**
     * The pull instance command can be used to create a new powersync project directory
     */
    const projectDir = this.resolveProjectDir(flags);
    if (!existsSync(projectDir)) {
      if (instanceId && orgId && projectId) {
        mkdirSync(projectDir, { recursive: true });
      } else {
        this.styledError({
          message: `Directory "${directory}" not found. Pass ${ux.colorize('blue', '--instance-id, --org-id, and --project-id')} to create the config directory and link, or run this command from a directory that already contains a linked PowerSync config.`
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
      if (!instanceId || !orgId || !projectId) {
        this.styledError({
          message: `Linking is required. Pass ${ux.colorize('blue', '--instance-id, --org-id, and --project-id')} to this command, or run ${ux.colorize('blue', 'powersync link cloud --instance-id=<id> --org-id=<id> --project-id=<id>')} first.`
        });
      }
      writeCloudLink(projectDir, { instanceId, orgId, projectId });
      this.log(ux.colorize('green', `Created ${directory}/${CLI_FILENAME} with Cloud instance link.`));
    }

    const { linked } = this.loadProject(flags);
    const client = await this.getClient();

    this.log(
      `Fetching config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}...`
    );

    const fetched = await fetchCloudConfig(client, linked).catch((error) => {
      this.styledError({
        message: `Failed to fetch config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`,
        error
      });
    });

    const serviceExists = existsSync(join(projectDir, SERVICE_FILENAME));
    const syncExists = existsSync(join(projectDir, SYNC_FILENAME));
    if (serviceExists) {
      this.warn(
        ux.colorize(
          'yellow',
          `${SERVICE_FILENAME} already exists. Writing to service-fetched.yaml instead. Manually merge the settings into ${SERVICE_FILENAME} as needed.`
        )
      );
    }
    if (syncExists && fetched.syncRules) {
      this.warn(
        ux.colorize(
          'yellow',
          `${SYNC_FILENAME} already exists. Writing to sync-fetched.yaml instead. Manually merge the sync rules into ${SYNC_FILENAME} as needed.`
        )
      );
    }
    const serviceYaml = PULL_CONFIG_HEADER + stringify(ServiceCloudConfig.encode(fetched.config));

    const serviceOutputName = serviceExists ? SERVICE_FETCHED_FILENAME : SERVICE_FILENAME;
    const serviceOutputPath = join(projectDir, serviceOutputName);
    this.log('');
    writeFileSync(serviceOutputPath, serviceYaml, 'utf8');
    this.log(ux.colorize('green', `Wrote ${serviceOutputName} with config from the cloud.`));

    if (typeof fetched.syncRules === 'string') {
      const syncOutputName = syncExists ? SYNC_FETCHED_FILENAME : SYNC_FILENAME;
      const syncOutputPath = join(projectDir, syncOutputName);
      writeFileSync(syncOutputPath, fetched.syncRules, 'utf8');
      this.log(ux.colorize('green', `Wrote ${syncOutputName} with sync rules from the cloud.`));
    }
  }
}
