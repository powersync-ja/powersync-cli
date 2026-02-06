import { Flags } from '@oclif/core';
import { CLISelfHostedConfig, RequiredSelfHostedLinkConfig } from '@powersync/cli-schemas';
import { join } from 'node:path';
import { ensureServiceTypeMatches } from '../utils/ensureServiceType.js';
import { LINK_FILENAME, loadLinkDocument, loadServiceDocument, SERVICE_FILENAME } from '../utils/project-config.js';
import { EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';

export type SelfHostedProject = {
  projectDirectory: string;
  linked: RequiredSelfHostedLinkConfig;
};

/** Base command for operations that require a self-hosted PowerSync project (service.yaml _type: self-hosted). */
export abstract class SelfHostedInstanceCommand extends InstanceCommand {
  static flags = {
    ...InstanceCommand.flags,
    /**
     * All SelfHosted instance Commands support manually providing the API URL.
     * This can be useful for quickly performing an operation on a specific instance.
     * The order of precedence is:
     * 1. Flags passed to the command (explicitly provided)
     * 2. Link.yaml file (due to the current context)
     * 3. Environment variables (used if none of the above are provided)
     */
    ...InstanceCommand.flags,
    'api-url': Flags.string({
      description: 'PowerSync API URL. When set, context is treated as self-hosted (exclusive with --instance-id).',
      required: false
    })
  };

  loadProject(flags: { directory: string }, options?: EnsureConfigOptions): SelfHostedProject {
    const projectDir = this.ensureProjectDirExists(flags);

    ensureServiceTypeMatches({
      command: this,
      configRequired: options?.configFileRequired ?? false,
      directoryLabel: flags.directory,
      expectedType: 'self-hosted',
      projectDir
    });

    const linkPath = join(projectDir, LINK_FILENAME);
    const doc = loadLinkDocument(linkPath);
    let linked: RequiredSelfHostedLinkConfig;
    try {
      linked = RequiredSelfHostedLinkConfig.decode(doc.contents?.toJSON());
    } catch (error) {
      this.error(`Failed to parse ${LINK_FILENAME} as SelfHostedLinkConfig: ${error}`, { exit: 1 });
    }

    return {
      projectDirectory: projectDir,
      linked
    };
  }

  parseConfig(projectDirectory: string) {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = loadServiceDocument(servicePath);
    return CLISelfHostedConfig.decode(doc.contents?.toJSON());
  }
}
