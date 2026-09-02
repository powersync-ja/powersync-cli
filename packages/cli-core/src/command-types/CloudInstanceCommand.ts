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
import { LINK_MISSING_ERROR_MESSAGE } from '../utils/errors.js';
import { OBJECT_ID_REGEX } from '../utils/object-id.js';
import { CLI_FILENAME, SERVICE_FILENAME } from '../utils/project-config.js';
import { resolveCloudInstanceLink } from '../utils/resolve-cloud-instance-link.js';
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
 * 4. If org_id or project_id is still missing: resolve it from the Cloud instance.
 *
 * @example
 * # Use linked project (cli.yaml)
 * pnpm exec powersync some-cloud-cmd
 * # Override with env
 * INSTANCE_ID=... pnpm exec powersync some-cloud-cmd
 * # Override with flags
 * pnpm exec powersync some-cloud-cmd --instance-id=...
 */
export abstract class CloudInstanceCommand extends InstanceCommand {
  static baseFlags = {
    /**
     * Instance ID, org ID, and project ID are resolved in order: flags → cli.yaml → env (INSTANCE_ID, ORG_ID, PROJECT_ID).
     * Missing org/project IDs are resolved from the Cloud instance.
     */
    ...InstanceCommand.baseFlags,
    'instance-id': Flags.string({
      description: 'PowerSync Cloud instance ID. Manually passed if the current context has not been linked.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      required: false
    }),
    'org-id': Flags.string({
      deprecated: {
        message: '--org-id is a no-op. Organization ID is resolved automatically.'
      },
      description: '[Deprecated] Organization ID. Automatically resolved from --instance-id.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      hidden: true,
      required: false
    }),
    'project-id': Flags.string({
      deprecated: {
        message: '--project-id is a no-op. Project ID is resolved automatically.'
      },
      description: '[Deprecated] Project ID. Automatically resolved from --instance-id.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      hidden: true,
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

    // Only instance_id is accepted as a CLI flag - project_id and org_id overrides must come from cli.yaml
    const instance_id = flags['instance-id'] ?? (rawLink?.instance_id as string | undefined) ?? env.INSTANCE_ID;
    const project_id = rawLink?.project_id as string | undefined;
    const org_id = rawLink?.org_id as string | undefined;

    if (instance_id != null || project_id != null || org_id != null) {
      this.ensureObjectIdIfPresent(instance_id, '--instance-id');
      this.ensureObjectIdIfPresent(org_id, '--org-id');
      this.ensureObjectIdIfPresent(project_id, '--project-id');

      if (!instance_id) {
        this.styledError({ message: LINK_MISSING_ERROR_MESSAGE });
      }

      try {
        linked = ResolvedCloudCLIConfig.decode(
          await resolveCloudInstanceLink({
            client: this.client,
            instanceId: instance_id,
            orgId: org_id,
            projectId: project_id
          })
        );
      } catch (error) {
        this.styledError({ error, message: LINK_MISSING_ERROR_MESSAGE });
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

  /**
   * Prints which Cloud instance the command is about to act on, including its name, so users can confirm
   * they are targeting the correct instance before anything happens.
   *
   * Call this after loadProject(). The instance name is fetched from the Management API unless it is
   * already known (for example from a previous getInstanceConfig call). If the name cannot be fetched,
   * the IDs are still printed and the command continues; a later API call will surface any real error.
   *
   * @returns The instance name, or undefined if it could not be resolved.
   */
  async logTargetInstance(options: { instanceName?: string } = {}): Promise<string | undefined> {
    const { linked } = this.project;

    let { instanceName } = options;
    if (instanceName == null) {
      try {
        ({ name: instanceName } = await this.client.getInstance({ id: linked.instance_id }));
      } catch {
        // Fall through, IDs are still printed below.
      }
    }

    const nameLabel =
      instanceName == null ? ux.colorize('yellow', '(name unavailable)') : ux.colorize('blue', instanceName);
    this.log(`Target instance: ${nameLabel} ${ux.colorize('gray', `id: ${linked.instance_id}`)}`);
    this.log(
      `\t${ux.colorize('gray', `project: ${linked.project_id}`)} ${ux.colorize('gray', `org: ${linked.org_id}`)}`
    );

    return instanceName;
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
