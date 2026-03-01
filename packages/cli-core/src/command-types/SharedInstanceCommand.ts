import { Flags, Interfaces, ux } from '@oclif/core';
import {
  CLIConfig,
  CloudCLIConfig,
  ResolvedCloudCLIConfig,
  ResolvedSelfHostedCLIConfig,
  SelfHostedCLIConfig,
  ServiceCloudConfig,
  ServiceCloudConfigDecoded,
  ServiceSelfHostedConfig,
  ServiceSelfHostedConfigDecoded,
  validateCloudConfig,
  validateSelfHostedConfig
} from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getDefaultOrgId } from '../clients/AccountsHubClientSDKClient.js';
import { createCloudClient } from '../clients/create-cloud-client.js';
import { ensureServiceTypeMatches, ServiceType } from '../utils/ensure-service-type.js';
import { env } from '../utils/env.js';
import { CLI_FILENAME, SERVICE_FILENAME, SYNC_FILENAME } from '../utils/project-config.js';
import { parseYamlFile } from '../utils/yaml.js';
import { CloudProject } from './CloudInstanceCommand.js';
import { HelpGroup } from './HelpGroup.js';
import { DEFAULT_ENSURE_CONFIG_OPTIONS, EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';
import { SelfHostedProject } from './SelfHostedInstanceCommand.js';

export type SharedInstanceCommandFlags = Interfaces.InferredFlags<
  typeof SharedInstanceCommand.baseFlags & typeof SharedInstanceCommand.flags
>;

/**
 * Base command for operations that work with either a Cloud or self-hosted PowerSync instance.
 *
 * Resolution order:
 *
 * 1. **Context (cloud vs self-hosted)** — Cannot mix both.
 *    - First from flags.
 *    - Then from cli.yaml (if present).
 *    - Then from environment variables.
 *
 * 2. **Per-field values** (instance_id, org_id, project_id for cloud; api_url, api_key for self-hosted):
 *    - Cloud: flags → cli.yaml → env.
 *    - Self-hosted: api_url from flag → cli.yaml → env; api_key from env → cli.yaml only (no flag).
 *
 * @example
 * # Use linked project (cli.yaml determines cloud vs self-hosted)
 * pnpm exec powersync some-shared-cmd
 * # Force cloud with env
 * INSTANCE_ID=... ORG_ID=... PROJECT_ID=... pnpm exec powersync some-shared-cmd
 * # Force self-hosted with flag
 * pnpm exec powersync some-shared-cmd --api-url=https://...
 * # Force cloud with flags
 * pnpm exec powersync some-shared-cmd --instance-id=... --org-id=... --project-id=...
 */
export abstract class SharedInstanceCommand extends InstanceCommand {
  static flags = {
    'api-url': Flags.string({
      description:
        '[Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with --instance-id). Resolved: flag → cli.yaml → API_URL.',
      // Can't use this flag with cloud flags
      exclusive: ['instance-id', 'org-id', 'project-id'],
      helpGroup: HelpGroup.SELF_HOSTED_PROJECT,
      required: false
    }),
    'instance-id': Flags.string({
      dependsOn: ['project-id'],
      description:
        '[Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud (exclusive with --api-url). Resolved: flag → cli.yaml → INSTANCE_ID.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      required: false
    }),
    'org-id': Flags.string({
      description:
        '[Cloud] Organization ID (optional). Defaults to the token’s single org when only one is available; pass explicitly if the token has multiple orgs. Resolved: flag → cli.yaml → ORG_ID.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      required: false
    }),
    'project-id': Flags.string({
      description: '[Cloud] Project ID. Resolved: flag → cli.yaml → PROJECT_ID.',
      helpGroup: HelpGroup.CLOUD_PROJECT,
      required: false
    }),
    ...InstanceCommand.flags
  };
cloudClient: PowerSyncManagementClient = createCloudClient();

  /**
   * Some commands require contacting a provisioned PowerSync instance.
   * This verifies that the linked instance is provisioned, and shows an error with next steps if it's not.
   */
  async ensureCloudProvisioned(project: CloudProject) {
    const status = await this.cloudClient.getInstanceStatus({
      app_id: project.linked.project_id,
      id: project.linked.instance_id,
      org_id: project.linked.org_id
    });
    if (!status.provisioned) {
      this.styledError({
        message: `Instance ${project.linked.instance_id} is not provisioned. Please provision the instance with ${ux.colorize('blue', 'powersync deploy')} before running this command.`
      });
    }
  }

  async loadProject(
    flags: SharedInstanceCommandFlags,
    options: EnsureConfigOptions = DEFAULT_ENSURE_CONFIG_OPTIONS
  ): Promise<CloudProject | SelfHostedProject> {
    const resolvedOptions = {
      ...DEFAULT_ENSURE_CONFIG_OPTIONS,
      // Keep this order so call-site options override defaults.
      ...options
    };

    const projectDir = this.ensureProjectDirectory(flags);
    const linkPath = join(projectDir, CLI_FILENAME);

    // 1) Context type: flags first, then link file, then env (see class JSDoc for resolution order).
    const hasCloudFlagInputs = flags['instance-id'] || flags['org-id'] || flags['project-id'];
    const hasSelfHostedFlagInputs = flags['api-url'];

    if (hasCloudFlagInputs && hasSelfHostedFlagInputs) {
      this.styledError({ message: 'Cannot use both cloud and self-hosted inputs. Use one or the other.' });
    }

    let projectType: null | ServiceType = hasSelfHostedFlagInputs
      ? ServiceType.SELF_HOSTED
      : hasCloudFlagInputs
        ? ServiceType.CLOUD
        : null;

    // If type not set by flags, use link file type (if present).
    let rawCLIConfig: CLIConfig | null = null;
    if (existsSync(linkPath)) {
      const doc = parseYamlFile(linkPath);
      rawCLIConfig = CLIConfig.decode(doc.contents?.toJSON());
      if (rawCLIConfig.type === 'self-hosted') {
        projectType = ServiceType.SELF_HOSTED;
      } else if (rawCLIConfig.type === 'cloud') {
        projectType = ServiceType.CLOUD;
      }
    }

    // If type still not set, use env inputs.
    if (!projectType) {
      const hasCloudEnvInputs = env.INSTANCE_ID || env.ORG_ID || env.PROJECT_ID;
      const hasSelfHostedEnvInputs = env.API_URL;

      if (hasCloudEnvInputs && hasSelfHostedEnvInputs) {
        this.styledError({ message: 'Cannot use both cloud and self-hosted inputs. Use one or the other.' });
      }

      projectType = hasSelfHostedEnvInputs ? ServiceType.SELF_HOSTED : hasCloudEnvInputs ? ServiceType.CLOUD : null;
    }

    const linkMissingErrorMessage = [
      'Linking is required before using this command.',
      'Provide --api-url (self-hosted) or --instance-id with --org-id and --project-id (cloud), or link the project first.'
    ].join('\n');

    // If we don't have a project type by now, we need to error
    if (!projectType) {
      this.styledError({ message: linkMissingErrorMessage });
    }

    // 2) Per-field: flags → link file → env (see class JSDoc).
    let cliConfig: null | ResolvedCloudCLIConfig | ResolvedSelfHostedCLIConfig = null;
    if (projectType === 'self-hosted') {
      const _rawSelfHostedCLIConfig = (rawCLIConfig as SelfHostedCLIConfig) ?? { type: 'self-hosted' };
      try {
        cliConfig = ResolvedSelfHostedCLIConfig.decode({
          ..._rawSelfHostedCLIConfig,
          api_key: env.PS_ADMIN_TOKEN ?? _rawSelfHostedCLIConfig.api_key!,
          api_url: flags['api-url'] ?? _rawSelfHostedCLIConfig.api_url! ?? env.API_URL
        });
      } catch (error) {
        this.styledError({ error, message: linkMissingErrorMessage });
      }
    } else {
      const _rawCloudCLIConfig = (rawCLIConfig as CloudCLIConfig) ?? { type: 'cloud' };
      try {
        let org_id = flags['org-id'] ?? _rawCloudCLIConfig.org_id ?? env.ORG_ID;
        if (org_id == null && (flags['instance-id'] || env.INSTANCE_ID)) {
          org_id = await getDefaultOrgId();
        }

        cliConfig = ResolvedCloudCLIConfig.decode({
          ..._rawCloudCLIConfig,
          instance_id: flags['instance-id'] ?? _rawCloudCLIConfig.instance_id! ?? env.INSTANCE_ID,
          org_id: org_id!,
          project_id: flags['project-id'] ?? _rawCloudCLIConfig.project_id! ?? env.PROJECT_ID
        });
      } catch (error) {
        this.styledError({ error, message: linkMissingErrorMessage });
      }
    }

    if (!cliConfig) {
      this.styledError({ message: linkMissingErrorMessage });
    }

    // ensure the link config is valid
    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: projectDir,
      expectedType: projectType!,
      projectDir
    });

    const syncRulesPath = join(projectDir, SYNC_FILENAME);
    let syncRulesContent: string | undefined;
    if (existsSync(syncRulesPath)) {
      syncRulesContent = readFileSync(syncRulesPath, 'utf8');
    }

    if (!existsSync(join(projectDir, SERVICE_FILENAME)) && resolvedOptions.configFileRequired) {
      this.styledError({
        message: `Config file "${SERVICE_FILENAME}" not found in directory "${projectDir}". This command requires a config file to run. Please create one and try again.`
      });
    }

    if (projectType === ServiceType.CLOUD) {
      return {
        linked: cliConfig as ResolvedCloudCLIConfig,
        projectDirectory: projectDir,
        syncRulesContent
      };
    }

    return {
      linked: cliConfig as ResolvedSelfHostedCLIConfig,
      projectDirectory: projectDir,
      syncRulesContent
    };
  }

  parseCloudConfig(projectDirectory: string): ServiceCloudConfigDecoded {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = parseYamlFile(servicePath);

    // validate the config with full schema
    const validationResult = validateCloudConfig(doc.contents?.toJSON());
    if (!validationResult.valid) {
      throw new Error(`Invalid cloud config: ${validationResult.errors?.join('\n')}`);
    }

    return ServiceCloudConfig.decode(doc.contents?.toJSON());
  }

  parseSelfHostedConfig(projectDirectory: string): ServiceSelfHostedConfigDecoded {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = parseYamlFile(servicePath);

    // validate the config with full schema
    const validationResult = validateSelfHostedConfig(doc.contents?.toJSON());
    if (!validationResult.valid) {
      throw new Error(`Invalid self-hosted config: ${validationResult.errors?.join('\n')}`);
    }

    return ServiceSelfHostedConfig.decode(doc.contents?.toJSON());
  }
}
