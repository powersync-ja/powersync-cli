import { Flags, Interfaces } from '@oclif/core';
import { CLISelfHostedConfig, RequiredSelfHostedLinkConfig } from '@powersync/cli-schemas';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureServiceTypeMatches } from '../utils/ensureServiceType.js';
import { env } from '../utils/env.js';
import { LINK_FILENAME, loadServiceDocument, SERVICE_FILENAME } from '../utils/project-config.js';
import { parseYamlFile } from '../utils/yaml.js';
import { HelpGroup } from './HelpGroup.js';
import { EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';

export type SelfHostedProject = {
  projectDirectory: string;
  linked: RequiredSelfHostedLinkConfig;
};

export type SelfHostedInstanceCommandFlags = Interfaces.InferredFlags<
  typeof SelfHostedInstanceCommand.flags & typeof SelfHostedInstanceCommand.baseFlags
>;

/**
 * Base command for operations that require a self-hosted PowerSync project (service.yaml _type: self-hosted).
 *
 * Instance context (api_url, api_key) is resolved in this order:
 * 1. Environment variables (API_URL, PS_TOKEN)
 * 2. Linked config from link.yaml
 *
 * API key is never accepted via command-line flags to avoid storing credentials in shell history.
 *
 * @example
 * # Use linked project (link.yaml)
 * pnpm exec powersync some-self-hosted-cmd
 * # Override with env
 * API_URL=... PS_TOKEN=... pnpm exec powersync some-self-hosted-cmd
 */
export abstract class SelfHostedInstanceCommand extends InstanceCommand {
  static flags = {
    ...InstanceCommand.flags,
    'api-url': Flags.string({
      description: 'PowerSync API URL. Resolved: flag → API_URL → link.yaml.',
      required: false,
      helpGroup: HelpGroup.SELF_HOSTED_PROJECT
    })
  };

  loadProject(flags: SelfHostedInstanceCommandFlags, options?: EnsureConfigOptions): SelfHostedProject {
    const projectDir = this.ensureProjectDirExists(flags);

    ensureServiceTypeMatches({
      command: this,
      configRequired: options?.configFileRequired ?? false,
      directoryLabel: flags.directory,
      expectedType: 'self-hosted',
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

    // Resolved per field: flags (api-url only) → env → link file. API key from env or link file only (no flag).
    const api_url = flags['api-url'] ?? env.API_URL ?? (rawLink?.api_url as string | undefined);
    const api_key = env.PS_TOKEN ?? (rawLink?.api_key as string | undefined);

    let linked: RequiredSelfHostedLinkConfig | null = null;
    try {
      linked = RequiredSelfHostedLinkConfig.decode({
        type: 'self-hosted',
        api_url: api_url!,
        api_key: api_key!
      });
    } catch (error) {
      if (options?.linkingIsRequired) {
        this.error(
          `Linking is required before using this command. Set API_URL and PS_TOKEN, or link the project first (link.yaml). ${error}`,
          { exit: 1 }
        );
      }
    }

    if (!linked && options?.linkingIsRequired) {
      this.error(
        [
          'Linking is required before using this command.',
          'Set API_URL and PS_TOKEN, or link the project first (link.yaml).'
        ].join('\n'),
        { exit: 1 }
      );
    }

    return {
      projectDirectory: projectDir,
      linked: linked!
    };
  }

  parseConfig(projectDirectory: string) {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = loadServiceDocument(servicePath);
    return CLISelfHostedConfig.decode(doc.contents?.toJSON());
  }
}
