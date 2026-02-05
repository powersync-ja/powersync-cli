import { Flags, Interfaces } from '@oclif/core';
import { CLICloudConfig, RequiredCloudLinkConfig } from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCloudClient } from '../clients/CloudClient.js';
import { ensureServiceTypeMatches } from '../utils/ensureServiceType.js';
import { env } from '../utils/env.js';
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

/**
 * Parsed (output) type of CloudInstanceCommand flags.
 * Use when you need the type of `flags` from `await this.parse(CloudInstanceCommand)`.
 */
export type CloudInstanceCommandFlags = Interfaces.InferredFlags<
  typeof CloudInstanceCommand.flags & typeof CloudInstanceCommand.baseFlags
>;

/** Base command for operations that require a Cloud-type PowerSync project (service.yaml _type: cloud). */
export abstract class CloudInstanceCommand extends InstanceCommand {
  static flags = {
    /**
     * All Cloud instance Commands support manually providing the instance ID, org ID, and project ID.
     * This can be useful for quickly performing an operation on a specific instance.
     * The order of precedence is:
     * 1. Flags passed to the command (explicitly provided)
     * 2. Link.yaml file (due to the current context)
     * 3. Environment variables (used if none of the above are provided)
     */
    ...InstanceCommand.flags,
    'instance-id': Flags.string({
      description: 'PowerSync Cloud instance ID. Manually passed if the current context has not been linked.',
      required: false
    }),
    'org-id': Flags.string({
      description: 'Organization ID. Manually passed if the current context has not been linked.',
      required: false
    }),
    'project-id': Flags.string({
      description: 'Project ID. Manually passed if the current context has not been linked.',
      required: false
    })
  };

  /**
   * @returns A PowerSync Management Client for the Cloud (uses token from login).
   */
  async getClient(): Promise<PowerSyncManagementClient> {
    return createCloudClient();
  }

  loadProject(flags: CloudInstanceCommandFlags, options?: EnsureConfigOptions): CloudProject {
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

    let linked: RequiredCloudLinkConfig | null = null;
    if (flags['instance-id']) {
      try {
        // Use the decode to validate the flags
        linked = RequiredCloudLinkConfig.decode({
          type: 'cloud',
          instance_id: flags['instance-id'],
          org_id: flags['org-id']!,
          project_id: flags['project-id']!
        });
      } catch (error) {
        // It's only an error if linking is required
        if (options?.linkingIsRequired) {
          this.error(
            `Linking is required before using this command. Explicitly provided flags were specified, but validation failed ${error}`,
            { exit: 1 }
          );
        }
      }
    } else if (existsSync(linkPath)) {
      try {
        const linkPath = join(projectDir, LINK_FILENAME);
        const doc = loadLinkDocument(linkPath);
        linked = RequiredCloudLinkConfig.decode(doc.contents?.toJSON());
      } catch (error) {
        if (options?.linkingIsRequired) {
          this.error(`Failed to parse ${LINK_FILENAME} as CloudLinkConfig: ${error}`, { exit: 1 });
        }
      }
    } else if (env.INSTANCE_ID) {
      try {
        linked = RequiredCloudLinkConfig.decode({
          type: 'cloud',
          instance_id: env.INSTANCE_ID,
          org_id: env.ORG_ID!,
          project_id: env.PROJECT_ID!
        });
      } catch (error) {
        if (options?.linkingIsRequired) {
          this.error(`Failed to parse environment variables as CloudLinkConfig: ${error}`, { exit: 1 });
        }
      }
    }

    if (!linked && options?.linkingIsRequired) {
      this.error(
        `Linking is required before using this command. No linking information was found in the current context.`,
        { exit: 1 }
      );
    }

    const syncRulesPath = join(projectDir, SYNC_FILENAME);
    let syncRulesContent: string | undefined;
    if (existsSync(syncRulesPath)) {
      syncRulesContent = readFileSync(syncRulesPath, 'utf8');
    }
    return {
      projectDirectory: projectDir,
      linked: linked!,
      syncRulesContent
    };
  }

  parseConfig(projectDirectory: string) {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = loadServiceDocument(servicePath);
    return CLICloudConfig.decode(doc.contents?.toJSON());
  }
}
