import { Flags, Interfaces } from '@oclif/core';
import {
  CLICloudConfig,
  CLISelfHostedConfig,
  CloudLinkConfig,
  LinkConfig,
  RequiredCloudLinkConfig,
  RequiredSelfHostedLinkConfig,
  SelfHostedLinkConfig
} from '@powersync/cli-schemas';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureServiceTypeMatches } from '../utils/ensureServiceType.js';
import { env } from '../utils/env.js';
import {
  LINK_FILENAME,
  loadLinkDocument,
  loadServiceDocument,
  SERVICE_FILENAME,
  SYNC_FILENAME
} from '../utils/project-config.js';
import { CloudProject } from './CloudInstanceCommand.js';
import { HelpGroup } from './HelpGroup.js';
import { EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';
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
 *    - If neither set: type is taken from link.yaml (if present).
 *
 * 2. **Per-field values** (instance_id, org_id, project_id for cloud; api_url, api_key for self-hosted):
 *    - Flags (e.g. --instance-id, --api-url) → environment variables (INSTANCE_ID, API_URL, etc.) → link.yaml.
 *
 * @example
 * # Use linked project (link.yaml determines cloud vs self-hosted)
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
        '[Self-hosted] PowerSync API URL. When set, context is treated as self-hosted (exclusive with --instance-id). Resolved: flag → API_URL → link.yaml.',
      required: false,
      helpGroup: HelpGroup.SELF_HOSTED_PROJECT
    }),
    'instance-id': Flags.string({
      description:
        '[Cloud] PowerSync Cloud instance ID (BSON ObjectID). When set, context is treated as cloud (exclusive with --api-url). Resolved: flag → INSTANCE_ID → link.yaml.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    'org-id': Flags.string({
      description: '[Cloud] Organization ID. Resolved: flag → ORG_ID → link.yaml.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    'project-id': Flags.string({
      description: '[Cloud] Project ID. Resolved: flag → PROJECT_ID → link.yaml.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    ...InstanceCommand.flags
  };

  loadProject(flags: SharedInstanceCommandFlags, options?: EnsureConfigOptions): CloudProject | SelfHostedProject {
    const projectDir = this.ensureProjectDirExists(flags);
    const linkPath = join(projectDir, LINK_FILENAME);

    // 1) Context type: from flags/env first, then link file (see class JSDoc for resolution order).
    const hasCloudInstanceInputs = flags['instance-id'] || env.INSTANCE_ID || flags['org-id'] || flags['project-id'];
    const hasSelfHostedInputs = flags['api-url'] || env.API_URL;

    if (hasCloudInstanceInputs && hasSelfHostedInputs) {
      this.error(['Cannot use both cloud and self-hosted inputs. Use one or the other.'].join('\n'), { exit: 1 });
    }

    let projectType: 'cloud' | 'self-hosted' | null = hasSelfHostedInputs
      ? 'self-hosted'
      : hasCloudInstanceInputs
        ? 'cloud'
        : null;

    // If type not set by flags/env, use link file type (if present).
    let rawLinkConfig: LinkConfig | null = null;
    // check if the link file exists
    if (existsSync(linkPath)) {
      const doc = loadLinkDocument(linkPath);
      rawLinkConfig = LinkConfig.decode(doc.contents?.toJSON());
      if (rawLinkConfig.type === 'self-hosted') {
        projectType = 'self-hosted';
      } else if (rawLinkConfig.type === 'cloud') {
        projectType = 'cloud';
      }
    }

    const linkMissingErrorMessage = [
      'Linking is required before using this command.',
      'Provide --api-url (self-hosted) or --instance-id with --org-id and --project-id (cloud), or link the project first.'
    ].join('\n');

    // If we don't have a project type by now, we need to error
    if (!projectType && options?.linkingIsRequired) {
      this.error(linkMissingErrorMessage, { exit: 1 });
    }

    // 2) Per-field: flags → env → link file (see class JSDoc).
    let linkConfig: RequiredCloudLinkConfig | RequiredSelfHostedLinkConfig | null = null;
    if (projectType === 'self-hosted') {
      const _rawSelfHostedLinkConfig = (rawLinkConfig as SelfHostedLinkConfig) ?? { type: 'self-hosted' };
      try {
        linkConfig = RequiredSelfHostedLinkConfig.decode({
          ..._rawSelfHostedLinkConfig,
          api_key: flags['api-key'] ?? env.PS_TOKEN ?? _rawSelfHostedLinkConfig.api_key!,
          api_url: flags['api-url'] ?? env.API_URL ?? _rawSelfHostedLinkConfig.api_url!
        });
      } catch (error) {
        if (options?.linkingIsRequired) {
          this.error(`${linkMissingErrorMessage}\n${error}`, { exit: 1 });
        }
      }
    } else {
      const _rawCloudLinkConfig = (rawLinkConfig as CloudLinkConfig) ?? { type: 'cloud' };
      try {
        linkConfig = RequiredCloudLinkConfig.decode({
          ..._rawCloudLinkConfig,
          instance_id: flags['instance-id'] ?? env.INSTANCE_ID ?? _rawCloudLinkConfig.instance_id!,
          org_id: flags['org-id'] ?? env.ORG_ID ?? _rawCloudLinkConfig.org_id!,
          project_id: flags['project-id'] ?? env.PROJECT_ID ?? _rawCloudLinkConfig.project_id!
        });
      } catch (error) {
        if (options?.linkingIsRequired) {
          this.error(`${linkMissingErrorMessage}\n${error}`, { exit: 1 });
        }
      }
    }

    if (!linkConfig && options?.linkingIsRequired) {
      this.error(linkMissingErrorMessage, { exit: 1 });
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

    if (projectType === 'cloud') {
      return {
        projectDirectory: projectDir,
        linked: linkConfig as RequiredCloudLinkConfig,
        syncRulesContent
      };
    }
    return {
      projectDirectory: projectDir,
      linked: linkConfig as RequiredSelfHostedLinkConfig,
      syncRulesContent
    };
  }

  parseCloudConfig(projectDirectory: string): CLICloudConfig {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = loadServiceDocument(servicePath);
    return CLICloudConfig.decode(doc.contents?.toJSON());
  }

  parseSelfHostedConfig(projectDirectory: string): CLISelfHostedConfig {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = loadServiceDocument(servicePath);
    return CLISelfHostedConfig.decode(doc.contents?.toJSON());
  }
}
