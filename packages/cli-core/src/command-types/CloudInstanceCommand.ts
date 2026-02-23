import { Flags, Interfaces } from '@oclif/core';
import {
  ResolvedCloudCLIConfig,
  ServiceCloudConfig,
  ServiceCloudConfigDecoded,
  validateCloudConfig
} from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCloudClient } from '../clients/CloudClient.js';
import { getDefaultOrgId } from '../clients/accounts-client.js';
import { ensureServiceTypeMatches, ServiceType } from '../utils/ensureServiceType.js';
import { env } from '../utils/env.js';
import { CLI_FILENAME, SERVICE_FILENAME, SYNC_FILENAME } from '../utils/project-config.js';
import { parseYamlFile } from '../utils/yaml.js';
import { HelpGroup } from './HelpGroup.js';
import { DEFAULT_ENSURE_CONFIG_OPTIONS, EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';

export type CloudProject = {
  projectDirectory: string;
  linked: ResolvedCloudCLIConfig;
  syncRulesContent?: string;
};

/**
 * Parsed (output) type of CloudInstanceCommand flags.
 * Use when you need the type of `flags` from `await this.parse(CloudInstanceCommand)`.
 */
export type CloudInstanceCommandFlags = Interfaces.InferredFlags<
  typeof CloudInstanceCommand.flags & typeof CloudInstanceCommand.baseFlags
>;

/**
 * Base command for operations that require a Cloud-type PowerSync project (service.yaml _type: cloud).
 *
 * Instance context (instance_id, org_id, project_id) is resolved in this order:
 * 1. Command-line flags (--instance-id, --org-id, --project-id)
 * 2. Environment variables (INSTANCE_ID, ORG_ID, PROJECT_ID)
 * 3. If org_id is still missing: token's single org (via accounts API); error if multiple orgs.
 * 4. Linked config from cli.yaml
 *
 * @example
 * # Use linked project (cli.yaml)
 * pnpm exec powersync some-cloud-cmd
 * # Override with env
 * INSTANCE_ID=... ORG_ID=... PROJECT_ID=... pnpm exec powersync some-cloud-cmd
 * # Override with flags
 * pnpm exec powersync some-cloud-cmd --instance-id=... --org-id=... --project-id=...
 */
export abstract class CloudInstanceCommand extends InstanceCommand {
  static flags = {
    /**
     * Instance ID, org ID, and project ID are resolved in order: flags → env (INSTANCE_ID, ORG_ID, PROJECT_ID) → cli.yaml.
     */
    ...InstanceCommand.flags,
    'instance-id': Flags.string({
      description: 'PowerSync Cloud instance ID. Manually passed if the current context has not been linked.',
      required: false,
      dependsOn: ['project-id'],
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    'org-id': Flags.string({
      description:
        'Organization ID (optional). Defaults to the token’s single org when only one is available; pass explicitly if the token has multiple orgs.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    'project-id': Flags.string({
      description: 'Project ID. Manually passed if the current context has not been linked.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
    })
  };

  /**
   * Used to interface with the PowerSync Management API for Cloud instances. Automatically created with the token from login (or TOKEN env variable).
   */
  client: PowerSyncManagementClient = createCloudClient();

  protected _project: CloudProject | null = null;

  /**
   * The currently loaded project, including linked instance information and sync config content. Call loadProject() before accessing this property. This is set to the loaded project after calling loadProject() to avoid multiple loads of the same project.
   */
  get project(): CloudProject {
    if (!this._project) {
      throw new Error('Project not loaded. Call loadProject() first.');
    }
    return this._project;
  }

  /**
   * The parsed service config from the service.yaml file. Call parseConfig() before accessing this property. This is set to the parsed config after calling parseConfig() to avoid multiple parses of the same config.
   */
  protected serviceConfig: ServiceCloudConfigDecoded | null = null;

  async loadProject(
    flags: CloudInstanceCommandFlags,
    options: EnsureConfigOptions = DEFAULT_ENSURE_CONFIG_OPTIONS
  ): Promise<CloudProject> {
    const resolvedOptions = {
      ...options,
      ...DEFAULT_ENSURE_CONFIG_OPTIONS
    };
    const projectDir = this.ensureProjectDirectory(flags);

    // Check if the service.yaml file is present and has _type: cloud
    ensureServiceTypeMatches({
      command: this,
      configRequired: resolvedOptions.configFileRequired,
      directoryLabel: flags.directory,
      expectedType: ServiceType.CLOUD,
      projectDir
    });

    const linkPath = join(projectDir, CLI_FILENAME);

    let linked: ResolvedCloudCLIConfig | null = null;
    if (flags['instance-id']) {
      try {
        const org_id = flags['org-id'] ?? env.ORG_ID ?? (await getDefaultOrgId());
        linked = ResolvedCloudCLIConfig.decode({
          type: 'cloud',
          instance_id: flags['instance-id'],
          org_id,
          project_id: flags['project-id']!
        });
      } catch (error) {
        // It's only an error if linking is required
        this.styledError({
          message:
            'Linking is required before using this command. Explicitly provided flags were specified, but validation failed.',
          error
        });
      }
    } else if (env.INSTANCE_ID) {
      try {
        const org_id = env.ORG_ID ?? (await getDefaultOrgId());
        linked = ResolvedCloudCLIConfig.decode({
          type: 'cloud',
          instance_id: env.INSTANCE_ID,
          org_id,
          project_id: env.PROJECT_ID!
        });
      } catch (error) {
        this.styledError({
          message: 'Failed to parse environment variables as CloudCLIConfig',
          error
        });
      }
    } else if (existsSync(linkPath)) {
      try {
        const linkPath = join(projectDir, CLI_FILENAME);
        const doc = parseYamlFile(linkPath);
        linked = ResolvedCloudCLIConfig.decode(doc.contents?.toJSON());
      } catch (error) {
        this.styledError({
          message: `Failed to parse ${CLI_FILENAME} as CloudCLIConfig`,
          error
        });
      }
    }

    if (!linked) {
      this.styledError({
        message:
          'Linking is required before using this command. No linking information was found in the current context.'
      });
    }

    const syncRulesPath = join(projectDir, SYNC_FILENAME);
    let syncRulesContent: string | undefined;
    if (existsSync(syncRulesPath)) {
      syncRulesContent = readFileSync(syncRulesPath, 'utf8');
    }
    return (this._project = {
      projectDirectory: projectDir,
      linked: linked!,
      syncRulesContent
    });
  }

  parseConfig(projectDirectory: string): ServiceCloudConfigDecoded {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = parseYamlFile(servicePath);

    //validate the config with full schema
    const validationResult = validateCloudConfig(doc.contents?.toJSON());
    if (!validationResult.valid) {
      throw new Error(`Invalid cloud config: ${validationResult.errors?.join('\n')}`);
    }
    return (this.serviceConfig = ServiceCloudConfig.decode(doc.contents?.toJSON()));
  }
}
