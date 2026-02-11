import { Flags, Interfaces } from '@oclif/core';
import {
  createCloudClient,
  EnsureConfigOptions,
  ensureServiceTypeMatches,
  env,
  HelpGroup,
  InstanceCommand,
  LINK_FILENAME,
  parseYamlFile,
  SERVICE_FILENAME,
  ServiceType,
  SYNC_FILENAME
} from '@powersync/cli-core';
import { CLICloudConfig, RequiredCloudLinkConfig } from '@powersync/cli-schemas';
import { PowerSyncManagementClient } from '@powersync/management-client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

/**
 * Base command for operations that require a Cloud-type PowerSync project (service.yaml _type: cloud).
 *
 * Instance context (instance_id, org_id, project_id) is resolved in this order:
 * 1. Command-line flags (--instance-id, --org-id, --project-id)
 * 2. Environment variables (INSTANCE_ID, ORG_ID, PROJECT_ID)
 * 3. Linked config from link.yaml
 *
 * @example
 * # Use linked project (link.yaml)
 * pnpm exec powersync some-cloud-cmd
 * # Override with env
 * INSTANCE_ID=... ORG_ID=... PROJECT_ID=... pnpm exec powersync some-cloud-cmd
 * # Override with flags
 * pnpm exec powersync some-cloud-cmd --instance-id=... --org-id=... --project-id=...
 */
export abstract class CloudInstanceCommand extends InstanceCommand {
  static flags = {
    /**
     * Instance ID, org ID, and project ID are resolved in order: flags → env (INSTANCE_ID, ORG_ID, PROJECT_ID) → link.yaml.
     */
    ...InstanceCommand.flags,
    'instance-id': Flags.string({
      description: 'PowerSync Cloud instance ID. Manually passed if the current context has not been linked.',
      required: false,
      dependsOn: ['org-id', 'project-id'],
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    'org-id': Flags.string({
      description: 'Organization ID. Manually passed if the current context has not been linked.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
    }),
    'project-id': Flags.string({
      description: 'Project ID. Manually passed if the current context has not been linked.',
      required: false,
      helpGroup: HelpGroup.CLOUD_PROJECT
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
      expectedType: ServiceType.CLOUD,
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
          this.styledError({
            message:
              'Linking is required before using this command. Explicitly provided flags were specified, but validation failed.',
            error
          });
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
          this.styledError({
            message: 'Failed to parse environment variables as CloudLinkConfig',
            error
          });
        }
      }
    } else if (existsSync(linkPath)) {
      try {
        const linkPath = join(projectDir, LINK_FILENAME);
        const doc = parseYamlFile(linkPath);
        linked = RequiredCloudLinkConfig.decode(doc.contents?.toJSON());
      } catch (error) {
        if (options?.linkingIsRequired) {
          this.styledError({
            message: `Failed to parse ${LINK_FILENAME} as CloudLinkConfig`,
            error
          });
        }
      }
    }

    if (!linked && options?.linkingIsRequired) {
      this.styledError({
        message:
          'Linking is required before using this command. No linking information was found in the current context.'
      });
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

  parseConfig(projectDirectory: string): CLICloudConfig {
    const servicePath = join(projectDirectory, SERVICE_FILENAME);
    const doc = parseYamlFile(servicePath);
    return CLICloudConfig.decode(doc.contents?.toJSON());
  }
}
