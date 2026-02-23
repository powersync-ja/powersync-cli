import { Flags, Interfaces } from '@oclif/core';
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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDefaultOrgId } from '../clients/accounts-client.js';
import { ensureServiceTypeMatches, ServiceType } from '../utils/ensureServiceType.js';
import { env } from '../utils/env.js';
import { CLI_FILENAME, SERVICE_FILENAME, SYNC_FILENAME } from '../utils/project-config.js';
import { parseYamlFile } from '../utils/yaml.js';
import { CloudProject } from './CloudInstanceCommand.js';
import { HelpGroup } from './HelpGroup.js';
import { DEFAULT_ENSURE_CONFIG_OPTIONS, EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';
import { SelfHostedProject } from './SelfHostedInstanceCommand.js';

export type SharedInstanceCommandFlags = Interfaces.InferredFlags<
  typeof SharedInstanceCommand.flags & typeof SharedInstanceCommand.baseFlags
>;

/**
 * Base command for operations that work with either a Cloud or self-hosted PowerSync instance.
 *
 * Resolution order:
 *
 * 1. **Context (cloud vs self-hosted)** — Cannot mix both.
 *    - Cloud: if any of --instance-id, INSTANCE_ID, --org-id, --project-id are set.
 *    - Self-hosted: if --api-url or API_URL is set.
 *    - If neither set: type is taken from cli.yaml (if present).
 *
 * 2. **Per-field values** (instance_id, org_id, project_id for cloud; api_url, api_key for self-hosted):
 *    - Cloud: flags → env → cli.yaml. Self-hosted: api_url from flag → env → cli.yaml; api_key from env → cli.yaml only (no flag).
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
        '[Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with --instance-id). Resolved: flag → API_URL → cli.yaml.',
      required: false,
      helpGroup: HelpGroup.SELF_HOSTED_PROJECT,
      // Can't use this flag with cloud flags
      exclusive: ['instance-id', 'org-id', 'project-id']
    }),
    'instance-id': Flags.string({
      description:
        '[Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud (exclusive with --api-url). Resolved: flag → INSTANCE_ID → cli.yaml.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT,
      dependsOn: ['project-id']
    }),
    'org-id': Flags.string({
      description:
        '[Cloud] Organization ID (optional). Defaults to the token’s single org when only one is available; pass explicitly if the token has multiple orgs. Resolved: flag → ORG_ID → cli.yaml.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    'project-id': Flags.string({
      description: '[Cloud] Project ID. Resolved: flag → PROJECT_ID → cli.yaml.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    ...InstanceCommand.flags
  };

  async loadProject(
    flags: SharedInstanceCommandFlags,
    options: EnsureConfigOptions = DEFAULT_ENSURE_CONFIG_OPTIONS
  ): Promise<CloudProject | SelfHostedProject> {
    const resolvedOptions = {
      ...options,
      ...DEFAULT_ENSURE_CONFIG_OPTIONS
    };

    const projectDir = this.ensureProjectDirectory(flags);
    const linkPath = join(projectDir, CLI_FILENAME);

    // 1) Context type: from flags/env first, then link file (see class JSDoc for resolution order).
    const hasCloudInstanceInputs =
      flags['instance-id'] || env.INSTANCE_ID || flags['org-id'] || env.ORG_ID || flags['project-id'];
    const hasSelfHostedInputs = flags['api-url'] || env.API_URL;

    if (hasCloudInstanceInputs && hasSelfHostedInputs) {
      this.styledError({ message: 'Cannot use both cloud and self-hosted inputs. Use one or the other.' });
    }

    let projectType: ServiceType | null = hasSelfHostedInputs
      ? ServiceType.SELF_HOSTED
      : hasCloudInstanceInputs
        ? ServiceType.CLOUD
        : null;

    // If type not set by flags/env, use link file type (if present).
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

    const linkMissingErrorMessage = [
      'Linking is required before using this command.',
      'Provide --api-url (self-hosted) or --instance-id with --org-id and --project-id (cloud), or link the project first.'
    ].join('\n');

    // If we don't have a project type by now, we need to error
    if (!projectType) {
      this.styledError({ message: linkMissingErrorMessage });
    }

    // 2) Per-field: flags → env → link file (see class JSDoc).
    let cliConfig: ResolvedCloudCLIConfig | ResolvedSelfHostedCLIConfig | null = null;
    if (projectType === 'self-hosted') {
      const _rawSelfHostedCLIConfig = (rawCLIConfig as SelfHostedCLIConfig) ?? { type: 'self-hosted' };
      try {
        cliConfig = ResolvedSelfHostedCLIConfig.decode({
          ..._rawSelfHostedCLIConfig,
          api_key: env.TOKEN ?? _rawSelfHostedCLIConfig.api_key!,
          api_url: flags['api-url'] ?? env.API_URL ?? _rawSelfHostedCLIConfig.api_url!
        });
      } catch (error) {
        this.styledError({ message: linkMissingErrorMessage, error });
      }
    } else {
      const _rawCloudCLIConfig = (rawCLIConfig as CloudCLIConfig) ?? { type: 'cloud' };
      try {
        let org_id = flags['org-id'] ?? env.ORG_ID ?? _rawCloudCLIConfig.org_id;
        if (org_id == null && (flags['instance-id'] || env.INSTANCE_ID)) {
          org_id = await getDefaultOrgId();
        }
        cliConfig = ResolvedCloudCLIConfig.decode({
          ..._rawCloudCLIConfig,
          instance_id: flags['instance-id'] ?? env.INSTANCE_ID ?? _rawCloudCLIConfig.instance_id!,
          org_id: org_id!,
          project_id: flags['project-id'] ?? env.PROJECT_ID ?? _rawCloudCLIConfig.project_id!
        });
      } catch (error) {
        this.styledError({ message: linkMissingErrorMessage, error });
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

    if (projectType === ServiceType.CLOUD) {
      return {
        projectDirectory: projectDir,
        linked: cliConfig as ResolvedCloudCLIConfig,
        syncRulesContent
      };
    }
    return {
      projectDirectory: projectDir,
      linked: cliConfig as ResolvedSelfHostedCLIConfig,
      syncRulesContent
    };
  }

  parseCloudConfig(projectDirectory: string): ServiceCloudConfigDecoded {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = parseYamlFile(servicePath);

    //validate the config with full schema
    const validationResult = validateCloudConfig(doc.contents?.toJSON());
    if (!validationResult.valid) {
      throw new Error(`Invalid cloud config: ${validationResult.errors?.join('\n')}`);
    }
    return ServiceCloudConfig.decode(doc.contents?.toJSON());
  }

  parseSelfHostedConfig(projectDirectory: string): ServiceSelfHostedConfigDecoded {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = parseYamlFile(servicePath);

    //validate the config with full schema
    const validationResult = validateSelfHostedConfig(doc.contents?.toJSON());
    if (!validationResult.valid) {
      throw new Error(`Invalid self-hosted config: ${validationResult.errors?.join('\n')}`);
    }
    return ServiceSelfHostedConfig.decode(doc.contents?.toJSON());
  }
}
