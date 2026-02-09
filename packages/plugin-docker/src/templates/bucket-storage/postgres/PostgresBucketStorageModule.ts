import { MergedServiceConfig } from '@powersync/service-schema';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scalar } from 'yaml';
import { DockerModule, DockerModuleContext, DockerModuleType } from '../../../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, 'resources');

const PostgresBucketStorageModule: DockerModule = {
  name: 'postgres',
  type: DockerModuleType.STORAGE,
  apply: async (context: DockerModuleContext) => {
    const { modulesOutputDirectory, serviceConfig } = context;
    const moduleOutputDirectory = path.join(modulesOutputDirectory, 'storage-postgres');

    fs.mkdirSync(moduleOutputDirectory, { recursive: true });

    const storageComposeFilePath = path.join(moduleOutputDirectory, 'postgres.storage.compose.yaml');
    fs.copyFileSync(path.join(RESOURCES_DIR, 'postgres.storage.compose.yaml'), storageComposeFilePath);

    const initScriptsSrc = path.join(RESOURCES_DIR, 'init-scripts');
    const initScriptsDest = path.join(moduleOutputDirectory, 'init-scripts');
    if (fs.existsSync(initScriptsSrc)) {
      fs.mkdirSync(initScriptsDest, { recursive: true });
      fs.cpSync(initScriptsSrc, initScriptsDest, { recursive: true });
    }

    const uri = new Scalar('!env PS_STORAGE_SOURCE_URI');
    uri.type = 'PLAIN';

    const storageConfig: MergedServiceConfig['storage'] = {
      type: 'postgresql',
      uri,
      sslmode: 'disable'
    };

    serviceConfig.set('storage', storageConfig);

    const additionalEnviroment = {
      PS_STORAGE_USER: 'postgres',
      PS_STORAGE_PASSWORD: 'changeme',
      PS_STORAGE_DATABASE: 'powersync_storage',
      PS_STORAGE_PORT: '5433',
      PS_STORAGE_SOURCE_URI:
        'postgresql://${PS_STORAGE_USER}:${PS_STORAGE_PASSWORD}@pg-storage:${PS_STORAGE_PORT}/${PS_STORAGE_DATABASE}'
    };

    return {
      additionalEnviroment,
      dockerIncludePaths: [storageComposeFilePath],
      dockerServiceNames: ['pg-storage']
    };
  }
};

export default PostgresBucketStorageModule;
