import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const SERVICE_FILENAME = 'service.yaml';

export type ServiceType = 'cloud' | 'self-hosted';

/**
 * Ensures service.yaml exists in the project dir and its _type matches the expected link type.
 * Calls command.error and exits if the file is missing, or _type is missing or mismatched.
 */
export function ensureServiceTypeMatches(
  command: { error: (message: string, options: { exit: number }) => never },
  projectDir: string,
  expectedType: ServiceType,
  directoryLabel: string
): void {
  const servicePath = join(projectDir, SERVICE_FILENAME);

  if (!existsSync(servicePath)) {
    command.error(
      `No ${SERVICE_FILENAME} found in "${directoryLabel}". Run \`powersync init\` first to create the project.`,
      { exit: 1 }
    );
  }

  const content = readFileSync(servicePath, 'utf8');
  const service = parseYaml(content) as { _type?: string };

  if (service._type === undefined || service._type === null) {
    command.error(
      `${SERVICE_FILENAME} in "${directoryLabel}" is missing \`_type\`. Add \`_type: ${expectedType}\` to match this link command.`,
      { exit: 1 }
    );
  }

  if (service._type !== expectedType) {
    command.error(
      `${SERVICE_FILENAME} in "${directoryLabel}" has \`_type: ${service._type}\` but you are running \`link ${expectedType}\`. The _type must match. Use \`powersync init --type=${expectedType}\` to create a project of the correct type, or change _type in ${SERVICE_FILENAME}.`,
      { exit: 1 }
    );
  }
}
