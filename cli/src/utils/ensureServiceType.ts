import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PowerSyncCommand } from '../command-types/PowerSyncCommand.js';
import { loadServiceDocument } from './project-config.js';

const SERVICE_FILENAME = 'service.yaml';

export type ServiceType = 'cloud' | 'self-hosted';

export type EnsureServiceTypeMatchesOptions = {
  command: PowerSyncCommand;
  configRequired: boolean;
  directoryLabel: string;
  expectedType: ServiceType;
  projectDir: string;
};

/**
 * Ensures, if it exists, that service.yaml in the project dir has _type matching the expected service type.
 * Calls command.error and exits if the file is missing, or _type is missing or mismatched.
 * Used by link, deploy, and other commands that require a specific project type (cloud or self-hosted).
 */
export function ensureServiceTypeMatches(options: EnsureServiceTypeMatchesOptions): void {
  const { command, configRequired, directoryLabel, expectedType, projectDir } = options;
  const servicePath = join(projectDir, SERVICE_FILENAME);

  if (!existsSync(servicePath)) {
    if (configRequired) {
      command.styledError({
        message: `${SERVICE_FILENAME} in "${directoryLabel}" is missing. Add \`_type: ${expectedType}\` for this command.`
      });
    }
    return;
  }

  const service = loadServiceDocument(servicePath);
  const serviceJson = service.contents?.toJSON();

  if (serviceJson?._type === undefined || serviceJson?._type === null) {
    command.styledError({
      message: `${SERVICE_FILENAME} in "${directoryLabel}" is missing \`_type\`. Add \`_type: ${expectedType}\` for this command.`
    });
  }

  if (serviceJson?._type !== expectedType) {
    command.styledError({
      message: `${SERVICE_FILENAME} in "${directoryLabel}" has \`_type: ${serviceJson?._type}\` but this command requires \`_type: ${expectedType}\`. Use \`powersync init --type=${expectedType}\` to create a project of the correct type, or change _type in ${SERVICE_FILENAME}.`
    });
  }
}
