import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';

import { Flags, ux } from '@oclif/core';
import {
  CLI_FILENAME,
  CloudInstanceCommand,
  CommandHelpGroup,
  ensureServiceTypeMatches,
  env,
  SERVICE_FILENAME,
  ServiceType,
  SYNC_FILENAME,
  YAML_SYNC_RULES_SCHEMA
} from '@powersync/cli-core';
import { ServiceCloudConfig } from '@powersync/cli-schemas';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildServiceYaml } from '../../api/build-service-yaml.js';
import { CLOUD_SERVICE_TEMPLATE_PATH, writeCloudSyncConfigFile } from '../../api/cloud/create-cloud-template.js';
import { decodeFetchedCloudConfig } from '../../api/cloud/fetch-cloud-config.js';
import { fetchCloudInstanceConfig } from '../../api/cloud/validate-cloud-link-config.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';

const SERVICE_FETCHED_FILENAME = 'service-fetched.yaml';
const SYNC_FETCHED_FILENAME = 'sync-fetched.yaml';

const PULL_CONFIG_HEADER = `# PowerSync Cloud config (fetched from cloud)
# yaml-language-server: $schema=https://unpkg.com/@powersync/cli-schemas@latest/json-schema/service-config.json
`.trim();

export default class PullInstance extends CloudInstanceCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description =
    'Fetch an existing Cloud instance by ID: create the config directory if needed, write cli.yaml, and download service.yaml and sync-config.yaml. Cloud only.';
  static examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --instance-id=<id>'];
  static flags = {
    overwrite: Flags.boolean({
      description:
        'Overwrite existing service.yaml and sync-config.yaml if they exist. By default, if these files already exist, the fetched configs will be written to service-fetched.yaml and sync-fetched.yaml to avoid overwriting local changes.'
    })
  };
  static summary =
    '[Cloud only] Pull an existing Cloud instance: link and download config into local service.yaml and sync-config.yaml.';

  async run(): Promise<void> {
    const { flags } = await this.parse(PullInstance);
    const { directory, 'instance-id': instanceId } = flags;
    const inputInstanceId = instanceId ?? env.INSTANCE_ID;

    let resolvedLink: ResolvedCloudCLIConfig | undefined;
    let instanceConfig;
    const projectDir = this.resolveProjectDir(flags);
    if (!existsSync(projectDir)) {
      if (!inputInstanceId) {
        this.styledError({
          message: `Directory "${directory}" not found. Pass --instance-id to create the config directory and link, or run this command from a directory that already contains a linked PowerSync config.`
        });
      }

      try {
        const validationResult = await fetchCloudInstanceConfig({
          cloudClient: this.client,
          instanceId: inputInstanceId
        });
        resolvedLink = validationResult.linked;
        instanceConfig = validationResult.instanceConfig;
      } catch (error) {
        this.styledError({ message: error instanceof Error ? error.message : String(error) });
      }

      mkdirSync(projectDir, { recursive: true });
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
      if (!resolvedLink) {
        if (!inputInstanceId) {
          this.styledError({
            message: `Linking is required. Pass --instance-id to this command, or run ${ux.colorize('blue', 'powersync link cloud --instance-id=<id>')} first.`
          });
        }

        try {
          const validationResult = await fetchCloudInstanceConfig({
            cloudClient: this.client,
            instanceId: inputInstanceId
          });
          resolvedLink = validationResult.linked;
          instanceConfig = validationResult.instanceConfig;
        } catch (error) {
          this.styledError({ message: error instanceof Error ? error.message : String(error) });
        }
      }

      if (!resolvedLink) {
        this.styledError({
          message: `Failed to resolve Cloud instance ${inputInstanceId}.`
        });
      }

      writeCloudLink(projectDir, {
        instanceId: resolvedLink.instance_id,
        orgId: resolvedLink.org_id,
        projectId: resolvedLink.project_id
      });
      this.log(`Created ${ux.colorize('blue', join(projectDir, CLI_FILENAME))} with Cloud instance link.`);
    }

    const { linked } = await this.loadProject(flags);

    if (!instanceConfig) {
      try {
        const validationResult = await fetchCloudInstanceConfig({
          cloudClient: this.client,
          instanceId: linked.instance_id,
          orgId: linked.org_id,
          projectId: linked.project_id
        });
        instanceConfig = validationResult.instanceConfig;
      } catch (error) {
        this.styledError({ message: error instanceof Error ? error.message : String(error) });
      }
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

    const { overwrite } = flags;
    const serviceExists = existsSync(join(projectDir, SERVICE_FILENAME));
    const syncExists = existsSync(join(projectDir, SYNC_FILENAME));
    if (!overwrite && serviceExists) {
      this.warn(
        `${ux.colorize('blue', SERVICE_FILENAME)} already exists. Writing to ${ux.colorize('blue', 'service-fetched.yaml')} instead. Manually merge the settings into ${ux.colorize('blue', SERVICE_FILENAME)} as needed.`
      );
    }

    if (!overwrite && syncExists && fetched.syncRules) {
      this.warn(
        `${ux.colorize('blue', SYNC_FILENAME)} already exists. Writing to ${ux.colorize('blue', 'sync-fetched.yaml')} instead. Manually merge the sync config into ${ux.colorize('blue', SYNC_FILENAME)} as needed.`
      );
    }

    const fetchedEncodedConfig = ServiceCloudConfig.encode(fetched.config);
    const serviceYaml = buildServiceYaml({
      baseConfig: fetchedEncodedConfig,
      schemaHeader: PULL_CONFIG_HEADER,
      templatePath: CLOUD_SERVICE_TEMPLATE_PATH
    });

    const serviceOutputName = !overwrite && serviceExists ? SERVICE_FETCHED_FILENAME : SERVICE_FILENAME;
    const serviceOutputPath = join(projectDir, serviceOutputName);
    this.log('');
    writeFileSync(serviceOutputPath, serviceYaml, 'utf8');
    this.log(`Wrote ${ux.colorize('blue', serviceOutputName)} with config from the cloud.`);

    if (typeof fetched.syncRules === 'string') {
      const syncOutputName = !overwrite && syncExists ? SYNC_FETCHED_FILENAME : SYNC_FILENAME;
      const syncOutputPath = join(projectDir, syncOutputName);
      writeFileSync(syncOutputPath, YAML_SYNC_RULES_SCHEMA + '\n' + fetched.syncRules, 'utf8');
      this.log(`Wrote ${ux.colorize('blue', syncOutputName)} with sync config from the cloud.`);
    } else if (!fetched.syncRules && !syncExists) {
      await writeCloudSyncConfigFile({ targetDir: projectDir });
      this.log(
        `Wrote ${ux.colorize('blue', SYNC_FILENAME)} with template sync config (no sync config found in the cloud).`
      );
    }
  }
}
