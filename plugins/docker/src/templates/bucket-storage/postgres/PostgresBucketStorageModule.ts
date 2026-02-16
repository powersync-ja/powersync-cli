import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, Scalar, YAMLSeq } from 'yaml';
import { DockerModule, DockerModuleContext, DockerModuleType } from '../../../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, 'resources');

const PostgresBucketStorageModule: DockerModule = {
  name: 'postgres',
  type: DockerModuleType.STORAGE,
  apply: async (context: DockerModuleContext) => {
    const { modulesOutputDirectory, serviceConfig, mainComposeDocument } = context;
    const moduleOutputDirectory = path.join(modulesOutputDirectory, 'storage-postgres');

    fs.mkdirSync(moduleOutputDirectory, { recursive: true });

    const storageComposeFilePath = path.join(moduleOutputDirectory, 'postgres.storage.compose.yaml');
    fs.copyFileSync(path.join(RESOURCES_DIR, 'postgres.storage.compose.yaml'), storageComposeFilePath);

    const initScriptsSrc = path.join(RESOURCES_DIR, 'init-scripts');
    const initScriptsDest = path.join(moduleOutputDirectory, 'init-scripts');
    fs.mkdirSync(initScriptsDest, { recursive: true });
    if (fs.existsSync(initScriptsSrc)) {
      fs.cpSync(initScriptsSrc, initScriptsDest, { recursive: true });
    }

    const includePath = path.relative(context.composeOutputDirectory, storageComposeFilePath);
    (mainComposeDocument.get('include') as YAMLSeq).add(includePath);

    const servicesNode = mainComposeDocument.get('services');
    if (isMap(servicesNode)) {
      const powersyncServiceNode = servicesNode.get('powersync');
      if (isMap(powersyncServiceNode)) {
        const dependsOnNode = powersyncServiceNode.get('depends_on');
        if (isMap(dependsOnNode)) {
          dependsOnNode.set('pg-storage', { condition: 'service_healthy' });
        }
      }
    }

    const uri = new Scalar('PS_STORAGE_SOURCE_URI');
    uri.type = 'PLAIN';
    uri.tag = '!env';

    const storageConfig = {
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

    return { additionalEnviroment };
  }
};

export default PostgresBucketStorageModule;
