import { Flags, Interfaces, ux } from '@oclif/core';
import {
  ResolvedCloudCLIConfig,
  ServiceCloudConfig,
  ServiceCloudConfigDecoded,
  validateCloudConfig
} from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createCloudClient } from '../clients/create-cloud-client.js';
import { ensureServiceTypeMatches, ServiceType } from '../utils/ensure-service-type.js';
import { env } from '../utils/env.js';
import { OBJECT_ID_REGEX } from '../utils/object-id.js';
import { CLI_FILENAME, SERVICE_FILENAME } from '../utils/project-config.js';
import { resolveSyncRulesContent } from '../utils/resolve-sync-rules-content.js';
import { parseYamlFile } from '../utils/yaml.js';
import { CommandHelpGroup, HelpGroup } from './HelpGroup.js';
import { DEFAULT_ENSURE_CONFIG_OPTIONS, EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';

export type CloudProject = {
  linked: ResolvedCloudCLIConfig;
  projectDirectory: string;
  syncRulesContent?: string;
};

/**
 * Parsed (output) type of CloudInstanceCommand flags.
 * Use when you need the type of `flags` from `await this.parse(CloudInstanceCommand)`.
 */
export type CloudInstanceCommandFlags = Interfaces.InferredFlags<
  typeof CloudInstanceCommand.baseFlags & typeof CloudInstanceCommand.flags
>;

/**
 * Base command for operations that require a Cloud-type PowerSync project (service.yaml _type: cloud).
 *
 * Instance context (instance_id, org_id, project_id) is resolved in this order:
 * 1. Command-line flags (--instance-id, --org-id, --project-id)
 * 2. Linked config from cli.yaml
 * 3. Environment variables (INSTANCE_ID, ORG_ID, PROJECT_ID)
 * 4. If org_id or project_id is still missing but instance_id is known: resolved via client.getInstance.
 *
 * @example
 * # Use linked project (cli.yaml)
 * pnpm exec powersync some-cloud-cmd
 * # Override with env
 * INSTANCE_ID=... pnpm exec powersync some-cloud-cmd
 * # Override with flags (--instance-id alone is sufficient)
 * pnpm exec powersync some-cloud-cmd --instance-id=...
 */
export abstract class CloudInstanceCommand extends InstanceCommand {
  static baseFlags = {
    /**
     * Instance ID, org ID, and project ID are resolved in order: flags → cli.yaml → env (INSTANCE_ID, ORG_ID, PROJECT_ID).
     * When only instance_id is available, org_id and project_id are resolved automatically via the management API.
     */
    ...InstanceCommand.baseFlags,
    'instance-id': Flags.string({
      description:
        'PowerSync Cloud instance ID. Pass when the current directory is not yet linked. org-id and project-id are resolved automatically.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      required: false
    }),
    'org-id': Flags.string({
      description: 'Organization ID. Auto-resolved from the instance when --instance-id is passed; rarely needed.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      required: false
    }),
    'project-id': Flags.string({
      description: 'Project ID. Auto-resolved from the instance when --instance-id is passed; rarely needed.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      required: false
    })
  };
  static commandHelpGroup = CommandHelpGroup.CLOUD;
  protected _project: CloudProject | null = null;
  /**
   * Used to interface with the PowerSync Management API for Cloud instances. Automatically created with the token from login (or PS_ADMIN_TOKEN env variable).
   */
  client: PowerSyncManagementClient = createCloudClient();
  /**
   * The parsed service config from the service.yaml file. Call parseLocalConfig() before accessing this property. This is set to the parsed config after calling parseLocalConfig() to avoid multiple parses of the same config.
   */
  protected serviceConfig: null | ServiceCloudConfigDecoded = null;

  /**
   * The currently loaded project, including linked instance information and sync config content. Call loadProject() before accessing this property. This is set to the loaded project after calling loadProject() to avoid multiple loads of the same project.
   */
  get project(): CloudProject {
    if (!this._project) {
      throw new Error('Project not loaded. Call loadProject() first.');
    }

    return this._project;
  }

  async _loadProjectHook(flags: CloudInstanceCommandFlags, project: CloudProject): Promise<CloudProject> {
    return project;
  }

  /**
   * Some commands require contacting a provisioned PowerSync instance.
   * This verifies that the linked instance is provisioned, and shows an error with next steps if it's not.
   */
  async ensureProvisioned() {
    const status = await this.client.getInstanceStatus({
      app_id: this.project.linked.project_id,
      id: this.project.linked.instance_id,
      org_id: this.project.linked.org_id
    });
    if (!status.provisioned) {
      this.styledError({
        message: `Instance ${this.project.linked.instance_id} is not provisioned. Please provision the instance with ${ux.colorize('blue', 'powersync deploy')} before running this command.`
      });
    }
  }

  async loadProject(
    flags: CloudInstanceCommandFlags,
    options: EnsureConfigOptions = DEFAULT_ENSURE_CONFIG_OPTIONS
  ): Promise<CloudProject> {
    const resolvedOptions = {
      ...DEFAULT_ENSURE_CONFIG_OPTIONS,
      // Keep this order so call-site options override defaults.
      ...options
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

    let linked: null | ResolvedCloudCLIConfig = null;
    let rawLink: null | Record<string, unknown> = null;

    if (existsSync(linkPath)) {
      try {
        const doc = parseYamlFile(linkPath);
        rawLink = doc.contents?.toJSON() as Record<string, unknown>;
      } catch (error) {
        this.styledError({
          error,
          message: `Failed to parse ${CLI_FILENAME} as CloudCLIConfig`
        });
      }
    }

    const instance_id = flags['instance-id'] ?? (rawLink?.instance_id as string | undefined) ?? env.INSTANCE_ID;
    // When --instance-id is explicitly passed, always resolve org/project from the API.
    // --org-id / --project-id flags are accepted for backward compatibility but ignored.
    const instanceIdFromFlag = flags['instance-id'] != null;
    let project_id = instanceIdFromFlag
      ? undefined
      : (flags['project-id'] ?? (rawLink?.project_id as string | undefined) ?? env.PROJECT_ID);
    let org_id = instanceIdFromFlag
      ? undefined
      : (flags['org-id'] ?? (rawLink?.org_id as string | undefined) ?? env.ORG_ID);

    if (instance_id != null && (org_id == null || project_id == null)) {
      try {
        const instanceMeta = await this.client.getInstance({ id: instance_id });
        org_id ??= instanceMeta.org_id;
        project_id ??= instanceMeta.app_id;
      } catch (error) {
        this.styledError({
          error,
          message: `Instance ${instance_id} was not found, or is not accessible with the current token.`
        });
      }
    }

    if (instance_id != null || project_id != null || org_id != null) {
      this.ensureObjectIdIfPresent(instance_id, '--instance-id');
      this.ensureObjectIdIfPresent(org_id, '--org-id');
      this.ensureObjectIdIfPresent(project_id, '--project-id');

      try {
        linked = ResolvedCloudCLIConfig.decode({
          instance_id: instance_id!,
          org_id: org_id!,
          project_id: project_id!,
          type: 'cloud'
        });
      } catch (error) {
        this.styledError({
          error,
          message:
            'Linking is required before using this command. Provide flags, link the project (cli.yaml), or set environment variables.'
        });
      }
    }

    if (!linked) {
      this.styledError({
        message:
          'Linking is required before using this command. No linking information was found in the current context.'
      });
    }

    const syncRulesContent = resolveSyncRulesContent({ projectDirectory: projectDir });

    this._project = await this._loadProjectHook(flags, {
      linked,
      projectDirectory: projectDir,
      syncRulesContent
    });

    return this._project;
  }

  parseLocalConfig(projectDirectory: string): ServiceCloudConfigDecoded {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = parseYamlFile(servicePath);

    // validate the config with full schema
    const validationResult = validateCloudConfig(doc.contents?.toJSON());
    if (!validationResult.valid) {
      throw new Error(`Invalid cloud config: ${validationResult.errors?.join('\n')}`);
    }

    this.serviceConfig = ServiceCloudConfig.decode(doc.contents?.toJSON());
    return this.serviceConfig;
  }

  private ensureObjectIdIfPresent(
    value: string | undefined,
    flagName: '--instance-id' | '--org-id' | '--project-id'
  ): void {
    if (value == null) {
      return;
    }

    if (!OBJECT_ID_REGEX.test(value)) {
      this.styledError({
        message: `Invalid ${flagName} "${value}". Expected a BSON ObjectID (24 hex characters).`
      });
    }
  }
}
