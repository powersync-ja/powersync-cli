import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadServiceDocument } from './project-config.js';

const SERVICE_FILENAME = 'service.yaml';

export type ServiceType = 'cloud' | 'self-hosted';

export type EnsureServiceTypeMatchesOptions = {
  command: { error: (message: string, options: { exit: number }) => never };
  configRequired: boolean;
  directoryLabel: string;
  expectedType: ServiceType;
  projectDir: string;
};

/**
 * Ensures, if it exists, that service.yaml in the project dir has _type matching the expected service type.
 */
export function ensureServiceTypeMatches(options: EnsureServiceTypeMatchesOptions): void {
  const { command, configRequired, directoryLabel, expectedType, projectDir } = options;
  const servicePath = join(projectDir, SERVICE_FILENAME);

  if (!existsSync(servicePath)) {
    if (configRequired) {
      command.error(
        `${SERVICE_FILENAME} in "${directoryLabel}" is missing. Add \`_type: ${expectedType}\` for this command.`,
        { exit: 1 }
      );
    }
    return;
  }

  const service = loadServiceDocument(servicePath);
  const serviceJson = service.contents?.toJSON();

  if (serviceJson?._type === undefined || serviceJson?._type === null) {
    command.error(
      `${SERVICE_FILENAME} in "${directoryLabel}" is missing \`_type\`. Add \`_type: ${expectedType}\` for this command.`,
      { exit: 1 }
    );
  }

  if (serviceJson?._type !== expectedType) {
    command.error(
      `${SERVICE_FILENAME} in "${directoryLabel}" has \`_type: ${serviceJson?._type}\` but this command requires \`_type: ${expectedType}\`. Use \`powersync init --type=${expectedType}\` to create a project of the correct type, or change _type in ${SERVICE_FILENAME}.`,
      { exit: 1 }
    );
  }
}
