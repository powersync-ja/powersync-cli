import { ux } from '@oclif/core';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { PowerSyncCommand } from '../command-types/PowerSyncCommand.js';
import { SERVICE_FILENAME } from './project-config.js';
import { parseYamlFile } from './yaml.js';

export enum ServiceType {
  CLOUD = 'cloud',
  SELF_HOSTED = 'self-hosted'
}

export type EnsureServiceTypeMatchesOptions = {
  command: PowerSyncCommand;
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
      command.styledError({
        message: `${SERVICE_FILENAME} in "./${directoryLabel}/" is missing. Ensure it exists and has \`_type: ${expectedType}\`. Use ${ux.colorize('blue', `powersync init ${expectedType}`)} to create a project of the correct type.`
      });
    }

    return;
  }

  const service = parseYamlFile(servicePath);
  const serviceJson = service.contents?.toJSON();

  if (serviceJson?._type === undefined || serviceJson?._type === null) {
    command.styledError({
      message: `${SERVICE_FILENAME} in "./${directoryLabel}/" is missing \`_type\`. Add \`_type: ${expectedType}\` for this command.`
    });
  }

  if (serviceJson?._type !== expectedType) {
    command.styledError({
      message: `${SERVICE_FILENAME} in "${directoryLabel}" has \`_type: ${serviceJson?._type}\` but this command requires \`_type: ${expectedType}\`. Use ${ux.colorize('blue', `powersync init ${expectedType}`)} to create a project of the correct type, or change _type in ${SERVICE_FILENAME}.`
    });
  }
}
