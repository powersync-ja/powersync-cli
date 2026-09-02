import { Flags, Interfaces, ux } from '@oclif/core';
import {
  CloudCLIConfig,
  ResolvedCloudCLIConfig,
  ServiceCloudConfig,
  ServiceCloudConfigDecoded,
  validateCloudConfig
} from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createCloudClient } from '../clients/create-cloud-client.js';
import { createEnvironmentFlag } from '../utils/create-environment-flag.js';
import { ensureServiceTypeMatches, ServiceType } from '../utils/ensure-service-type.js';
import { env } from '../utils/env.js';
import { LINK_MISSING_ERROR_MESSAGE } from '../utils/errors.js';
import { logTargetInstance } from '../utils/log-target-instance.js';
import { OBJECT_ID_REGEX } from '../utils/object-id.js';
import { CLI_FILENAME, SERVICE_FILENAME } from '../utils/project-config.js';
import { resolveCloudInstanceLink } from '../utils/resolve-cloud-instance-link.js';
import { resolveSyncRulesContent } from '../utils/resolve-sync-rules-content.js';
import { CloudLinkTarget, selectCloudLinkTarget, suggestEnvironments } from '../utils/select-cloud-link-target.js';
import { parseYamlFile } from '../utils/yaml.js';
import { CommandHelpGroup, HelpGroup } from './HelpGroup.js';
import { DEFAULT_ENSURE_CONFIG_OPTIONS, EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';

export type CloudProject = {
  /** Name of the cli.yaml environment the link was selected from, if any. */
  environment?: string;
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
 * 1. --instance-id
 * 2. The cli.yaml environment selected with --environment or POWERSYNC_ENVIRONMENT
 * 3. The top-level fields in cli.yaml
 * 4. INSTANCE_ID
 * 5. If org_id or project_id is still missing: resolve it from the Cloud instance.
 *
 * @example
 * # Use linked project (cli.yaml)
 * pnpm exec powersync some-cloud-cmd
 * # Use a named environment from cli.yaml
 * pnpm exec powersync some-cloud-cmd --environment=staging
 * # Override with env
 * INSTANCE_ID=... pnpm exec powersync some-cloud-cmd
 * # Override with flags
 * pnpm exec powersync some-cloud-cmd --instance-id=...
 */
export abstract class CloudInstanceCommand extends InstanceCommand {
  static baseFlags = {
    /**
     * Instance ID, org ID, and project ID are resolved in order: flags → cli.yaml (selected environment, then top-level fields) → INSTANCE_ID.
     * Missing org/project IDs are resolved from the Cloud instance.
     */
    ...InstanceCommand.baseFlags,
    environment: createEnvironmentFlag(['instance-id']),
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

    let cliConfig: CloudCLIConfig | null = null;
    if (existsSync(linkPath)) {
      try {
        cliConfig = CloudCLIConfig.decode(parseYamlFile(linkPath).contents?.toJSON());
      } catch (error) {
        this.styledError({ error, message: `Failed to parse ${CLI_FILENAME} as CloudCLIConfig` });
      }
    }

    const instanceIdFlag = flags['instance-id'];
    // --instance-id targets one instance directly, so a selected environment does not apply.
    const environment = instanceIdFlag ? undefined : (flags.environment ?? env.POWERSYNC_ENVIRONMENT);

    let target: CloudLinkTarget;
    try {
      target = selectCloudLinkTarget(cliConfig, environment);
    } catch (error) {
      this.styledError({ message: error instanceof Error ? error.message : String(error) });
    }

    const instance_id = instanceIdFlag ?? target.instance_id ?? env.INSTANCE_ID;
    if (!instance_id) {
      this.styledError({ message: LINK_MISSING_ERROR_MESSAGE, suggestions: suggestEnvironments(cliConfig) });
    }

    const linkField = (field: string) =>
      `${environment ? `environments.${environment}.${field}` : field} in ${CLI_FILENAME}`;
    this.ensureObjectIdIfPresent(
      instance_id,
      instanceIdFlag ? '--instance-id' : target.instance_id ? linkField('instance_id') : 'INSTANCE_ID'
    );
    this.ensureObjectIdIfPresent(target.org_id, linkField('org_id'));
    this.ensureObjectIdIfPresent(target.project_id, linkField('project_id'));

    let linked: ResolvedCloudCLIConfig;
    try {
      linked = ResolvedCloudCLIConfig.decode(
        await resolveCloudInstanceLink({
          client: this.client,
          instanceId: instance_id,
          orgId: target.org_id,
          projectId: target.project_id
        })
      );
    } catch (error) {
      this.styledError({ error, message: LINK_MISSING_ERROR_MESSAGE });
    }

    const syncRulesContent = resolveSyncRulesContent({ projectDirectory: projectDir });

    this._project = await this._loadProjectHook(flags, {
      environment: target.environment,
      linked,
      projectDirectory: projectDir,
      syncRulesContent
    });

    return this._project;
  }

  /**
   * Prints which Cloud instance the command is about to act on. Call this after loadProject().
   * See {@link logTargetInstance} for details and the returned label.
   */
  async logTargetInstance(options: { instanceName?: string } = {}): Promise<string> {
    return logTargetInstance({
      client: this.client,
      command: this,
      instanceName: options.instanceName,
      project: this.project
    });
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

  private ensureObjectIdIfPresent(value: string | undefined, label: string): void {
    if (value != null && !OBJECT_ID_REGEX.test(value)) {
      this.styledError({ message: `Invalid ${label} "${value}". Expected a BSON ObjectID (24 hex characters).` });
    }
  }
}
