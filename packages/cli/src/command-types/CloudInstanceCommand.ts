import { CLICloudConfig, RequiredCloudLinkConfig } from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCloudClient } from '../clients/CloudClient.js';
import { ensureServiceTypeMatches } from '../utils/ensureServiceType.js';
import {
  LINK_FILENAME,
  loadLinkDocument,
  loadServiceDocument,
  SERVICE_FILENAME,
  SYNC_FILENAME
} from '../utils/project-config.js';
import { EnsureConfigOptions, InstanceCommand } from './InstanceCommand.js';

export type CloudProject = {
  projectDirectory: string;
  linked: RequiredCloudLinkConfig;
  syncRulesContent?: string;
};

/** Base command for operations that require a Cloud-type PowerSync project (service.yaml _type: cloud). */
export abstract class CloudInstanceCommand extends InstanceCommand {
  static flags = {
    ...InstanceCommand.flags
  };

  /**
   * @returns A PowerSync Management Client for the Cloud (uses token from login).
   */
  async getClient(): Promise<PowerSyncManagementClient> {
    return createCloudClient();
  }

  loadProject(flags: { directory: string }, options?: EnsureConfigOptions): CloudProject {
    const projectDir = this.ensureProjectDirExists(flags);

    // Check if the service.yaml file is present and has _type: cloud
    ensureServiceTypeMatches({
      command: this,
      configRequired: options?.configFileRequired ?? false,
      directoryLabel: flags.directory,
      expectedType: 'cloud',
      projectDir
    });

    const linkPath = join(projectDir, LINK_FILENAME);
    if (options?.linkingIsRequired && !existsSync(linkPath)) {
      this.error(
        `Linking is required before using this command. Run:\n  powersync link cloud --instance-id=<id> --org-id=<id> --project-id=<id>\nSee \`powersync link cloud --help\` for details.`,
        { exit: 1 }
      );
    }

    let linked: RequiredCloudLinkConfig;
    try {
      const doc = loadLinkDocument(linkPath);
      linked = RequiredCloudLinkConfig.decode(doc.contents?.toJSON());
    } catch (error) {
      this.error(`Failed to parse ${LINK_FILENAME} as CloudLinkConfig: ${error}`, { exit: 1 });
    }

    const syncRulesPath = join(projectDir, SYNC_FILENAME);
    let syncRulesContent: string | undefined;
    if (existsSync(syncRulesPath)) {
      syncRulesContent = readFileSync(syncRulesPath, 'utf8');
    }
    return {
      projectDirectory: projectDir,
      linked,
      syncRulesContent
    };
  }

  parseConfig(projectDirectory: string) {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = loadServiceDocument(servicePath);
    return CLICloudConfig.decode(doc.contents?.toJSON());
  }
}
