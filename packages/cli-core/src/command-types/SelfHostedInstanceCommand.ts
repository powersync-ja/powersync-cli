import { Flags, Interfaces } from '@oclif/core';
import { CLISelfHostedConfig, RequiredSelfHostedLinkConfig } from '@powersync/cli-schemas';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureServiceTypeMatches, ServiceType } from '../utils/ensureServiceType.js';
import { env } from '../utils/env.js';
import { LINK_FILENAME, SERVICE_FILENAME } from '../utils/project-config.js';
import { parseYamlFile } from '../utils/yaml.js';
import { HelpGroup } from './HelpGroup.js';
import { DEFAULT_ENSURE_CONFIG_OPTIONS, EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';

export type SelfHostedProject = {
  projectDirectory: string;
  linked: RequiredSelfHostedLinkConfig;
};

export type SelfHostedInstanceCommandFlags = Interfaces.InferredFlags<
  typeof SelfHostedInstanceCommand.flags & typeof SelfHostedInstanceCommand.baseFlags
>;

/**
 * Base command for operations that require a self-hosted PowerSync project (service.yaml _type: self-hosted).
 * Import from @powersync/cli-core when building plugins.
 */
export abstract class SelfHostedInstanceCommand extends InstanceCommand {
  static flags = {
    ...InstanceCommand.flags,
    'api-url': Flags.string({
      description: 'PowerSync API URL. Resolved: flag → API_URL environment variable → link.yaml.',
      required: false,
      helpGroup: HelpGroup.SELF_HOSTED_PROJECT
    })
  };

  loadProject(
    flags: SelfHostedInstanceCommandFlags,
    options: EnsureConfigOptions = DEFAULT_ENSURE_CONFIG_OPTIONS
  ): SelfHostedProject {
    const resolvedOptions = {
      ...options,
      ...DEFAULT_ENSURE_CONFIG_OPTIONS
    };

    const projectDir = this.ensureProjectDirExists(flags);

    ensureServiceTypeMatches({
      command: this,
      configRequired: resolvedOptions.configFileRequired,
      directoryLabel: flags.directory,
      expectedType: ServiceType.SELF_HOSTED,
      projectDir
    });

    const linkPath = join(projectDir, LINK_FILENAME);
    let rawLink: Record<string, unknown> | null = null;
    if (existsSync(linkPath)) {
      try {
        const doc = parseYamlFile(linkPath);
        rawLink = doc.contents?.toJSON() as Record<string, unknown>;
      } catch {
        rawLink = null;
      }
    }

    const api_url = flags['api-url'] ?? env.API_URL ?? (rawLink?.api_url as string | undefined);
    const api_key = env.TOKEN ?? (rawLink?.api_key as string | undefined);

    let linked: RequiredSelfHostedLinkConfig | null = null;
    try {
      linked = RequiredSelfHostedLinkConfig.decode({
        ...(rawLink ?? {}),
        type: 'self-hosted',
        api_url: api_url!,
        api_key: api_key!
      });
    } catch (error) {
      this.styledError({
        message: 'Linking is required. Set API_URL and TOKEN, or link the project first (link.yaml).',
        error
      });
    }

    if (!linked) {
      this.styledError({
        message: 'Linking is required for this command. Set API_URL and TOKEN, or link the project first (link.yaml).'
      });
    }

    return {
      projectDirectory: projectDir,
      linked: linked!
    };
  }

  parseConfig(projectDirectory: string) {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = parseYamlFile(servicePath);
    return CLISelfHostedConfig.decode(doc.contents?.toJSON());
  }
}
