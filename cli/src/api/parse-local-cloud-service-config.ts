import { parseYamlFile, SERVICE_FILENAME } from '@powersync/cli-core';
import { ServiceCloudConfig, ServiceCloudConfigDecoded } from '@powersync/cli-schemas';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Parses the local service.yaml into a decoded cloud config.
 *
 * Returns `undefined` if the service config file does not exist, allowing callers to handle
 * the missing file gracefully (e.g. skipping connection validation in `powersync validate`).
 *
 * When `useRawConfig` is true the function returns the raw parsed YAML object instead of
 * decoding it through the generated codec. Decoding strips additional fields that are not yet
 * represented in the current schema or TypeScript types, so raw mode preserves those values
 * for flows where the user explicitly skips configuration validation.
 */
export function parseLocalCloudServiceConfig(
  projectDirectory: string,
  useRawConfig: boolean
): ServiceCloudConfigDecoded | undefined {
  const servicePath = join(projectDirectory, SERVICE_FILENAME);
  if (!existsSync(servicePath)) return undefined;

  let raw: ServiceCloudConfig | undefined;
  try {
    const doc = parseYamlFile(servicePath);
    raw = doc.contents?.toJSON();
    if (useRawConfig) {
      return raw;
    }

    return ServiceCloudConfig.decode(raw as ServiceCloudConfig);
  } catch (error) {
    if (!useRawConfig) throw error;
    return raw;
  }
}
