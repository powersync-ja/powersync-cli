import { CLI_FILENAME, SYNC_FILENAME, YAML_CLI_SCHEMA, YAML_SYNC_RULES_SCHEMA } from '@powersync/cli-core';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const CLOUD_TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'templates', 'cloud', 'powersync');

export const SERVICE_TEMPLATE_FILENAME = 'service.template.yaml';

export const CLOUD_SERVICE_TEMPLATE_PATH = join(CLOUD_TEMPLATES_DIR, SERVICE_TEMPLATE_FILENAME);
export const CLOUD_SYNC_CONFIG_TEMPLATE_PATH = join(CLOUD_TEMPLATES_DIR, SYNC_FILENAME);
export const CLOUD_CLI_TEMPLATE_PATH = join(CLOUD_TEMPLATES_DIR, CLI_FILENAME);

export type WriteCloudTemplateFilesParams = {
  targetDir: string;
};

export async function writeCloudSyncConfigFile(params: WriteCloudTemplateFilesParams) {
  const { targetDir } = params;
  const syncOutputPath = join(targetDir, SYNC_FILENAME);

  await copyFile(CLOUD_SYNC_CONFIG_TEMPLATE_PATH, syncOutputPath);
  await writeFile(syncOutputPath, `${YAML_SYNC_RULES_SCHEMA}\n\n${await readFile(syncOutputPath, 'utf8')}`);
}

/**
 * Copies the cloud template files to the provided destination.
 * YAML schemas are applied to copied files.
 * This copies the template Sync config and CLI config files.
 */
export async function writeCloudTemplateFiles(params: WriteCloudTemplateFilesParams): Promise<void> {
  const { targetDir } = params;

  // Create the target directory if it doesn't exist
  await mkdir(targetDir, { recursive: true });

  // Initial copy of template files
  const cliOutputPath = join(targetDir, CLI_FILENAME);

  await copyFile(CLOUD_CLI_TEMPLATE_PATH, cliOutputPath);
  // Add schemas to templates
  await writeFile(cliOutputPath, `${YAML_CLI_SCHEMA}\n\n${await readFile(cliOutputPath, 'utf8')}`);

  await writeCloudSyncConfigFile(params);
}
