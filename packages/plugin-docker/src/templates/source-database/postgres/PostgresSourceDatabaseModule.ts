import { MergedServiceConfig } from '@powersync/service-schema';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Scalar } from 'yaml';
import { DockerModule, DockerModuleContext, DockerModuleType } from '../../../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, 'resources');

const PostgresSourceDatabaseModule: DockerModule = {
  name: 'postgres',
  type: DockerModuleType.SOURCE_DATABASE,
  apply: async (context: DockerModuleContext) => {
    const { modulesOutputDirectory, serviceConfig } = context;

    const moduleOutputDirectory = path.join(modulesOutputDirectory, 'database-postgres');
    fs.mkdirSync(moduleOutputDirectory, { recursive: true });

    const databaseComposeFilePath = path.join(moduleOutputDirectory, 'postgres.database.compose.yaml');
    fs.copyFileSync(path.join(RESOURCES_DIR, 'postgres.database.compose.yaml'), databaseComposeFilePath);

    const initScriptsSrc = path.join(RESOURCES_DIR, 'init-scripts');
    const initScriptsDest = path.join(moduleOutputDirectory, 'init-scripts');
    if (fs.existsSync(initScriptsSrc)) {
      fs.mkdirSync(initScriptsDest, { recursive: true });
      fs.cpSync(initScriptsSrc, initScriptsDest, { recursive: true });
    }

    const uri = new Scalar('!env PS_DATA_SOURCE_URI');
    uri.type = 'PLAIN';

    const replicationConfig: MergedServiceConfig['replication'] = {
      connections: [
        {
          type: 'postgresql',
          uri,
          sslmode: 'disable'
        }
      ]
    };

    serviceConfig.set('replication', replicationConfig);

    const additionalEnviroment = {
      PS_DATABASE_USER: 'postgres',
      PS_DATABASE_PASSWORD: 'changeme',
      PS_DATABASE_NAME: 'postgres',
      PS_DATABASE_PORT: '5432',
      PS_DATA_SOURCE_URI:
        'postgresql://${PS_DATABASE_USER}:${PS_DATABASE_PASSWORD}@pg-db:${PS_DATABASE_PORT}/${PS_DATABASE_NAME}'
    };

    return {
      additionalEnviroment,
      dockerIncludePaths: [databaseComposeFilePath],
      dockerServiceNames: ['pg-db']
    };
  }
};

export default PostgresSourceDatabaseModule;
