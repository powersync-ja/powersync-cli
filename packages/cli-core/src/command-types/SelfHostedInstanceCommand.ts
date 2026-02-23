import { Flags, Interfaces } from '@oclif/core';
import {
  ResolvedSelfHostedCLIConfig,
  ServiceSelfHostedConfig,
  ServiceSelfHostedConfigDecoded,
  validateSelfHostedConfig
} from '@powersync/cli-schemas';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureServiceTypeMatches, ServiceType } from '../utils/ensureServiceType.js';
import { env } from '../utils/env.js';
import { CLI_FILENAME, SERVICE_FILENAME } from '../utils/project-config.js';
import { parseYamlFile } from '../utils/yaml.js';
import { HelpGroup } from './HelpGroup.js';
import { DEFAULT_ENSURE_CONFIG_OPTIONS, EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';

export type SelfHostedProject = {
  projectDirectory: string;
  linked: ResolvedSelfHostedCLIConfig;
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
      description: 'PowerSync API URL. Resolved: flag → API_URL environment variable → cli.yaml.',
      required: false,
      helpGroup: HelpGroup.SELF_HOSTED_PROJECT
    })
  };

  protected _project: SelfHostedProject | null = null;

  /**
   * The currently loaded project, including linked instance information and sync config content. Call loadProject() before accessing this property. This is set to the loaded project after calling loadProject() to avoid multiple loads of the same project.
   */
  get project(): SelfHostedProject {
    if (!this._project) {
      throw new Error('Project not loaded. Call loadProject() first.');
    }
    return this._project;
  }

  loadProject(
    flags: SelfHostedInstanceCommandFlags,
    options: EnsureConfigOptions = DEFAULT_ENSURE_CONFIG_OPTIONS
  ): SelfHostedProject {
    const resolvedOptions = {
      ...DEFAULT_ENSURE_CONFIG_OPTIONS,
      ...options
    };

    const projectDir = this.ensureProjectDirExists(flags);

    ensureServiceTypeMatches({
      command: this,
      configRequired: resolvedOptions.configFileRequired,
      directoryLabel: flags.directory,
      expectedType: ServiceType.SELF_HOSTED,
      projectDir
    });

    const linkPath = join(projectDir, CLI_FILENAME);
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

    let linked: ResolvedSelfHostedCLIConfig | null = null;
    try {
      linked = ResolvedSelfHostedCLIConfig.decode({
        ...(rawLink ?? {}),
        type: 'self-hosted',
        api_url: api_url!,
        api_key: api_key!
      });
    } catch (error) {
      this.styledError({
        message: 'Linking is required. Set API_URL and TOKEN, or link the project first (cli.yaml).',
        error
      });
    }

    if (!linked) {
      this.styledError({
        message: 'Linking is required for this command. Set API_URL and TOKEN, or link the project first (cli.yaml).'
      });
    }

    return {
      projectDirectory: projectDir,
      linked: linked!
    };
  }

  parseConfig(projectDirectory: string): ServiceSelfHostedConfigDecoded {
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
