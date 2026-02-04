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
    ...InstanceCommand.flags
  };

  loadProject(flags: { directory: string }, options?: EnsureConfigOptions): SelfHostedProject {
    const projectDir = this.ensureProjectDirExists(flags);

    // Check if the service.yaml file is present and has _type: cloud
    ensureServiceTypeMatches(this, projectDir, 'cloud', flags.directory, options?.configFileRequired ?? false);

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
