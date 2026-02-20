import { ux } from '@oclif/core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, Scalar, YAMLSeq } from 'yaml';
import { DockerModule, DockerModuleContext, DockerModuleType } from '../../../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, 'resources');

const PostgresSourceDatabaseModule: DockerModule = {
  name: 'postgres',
  type: DockerModuleType.SOURCE_DATABASE,
  apply: async (context: DockerModuleContext) => {
    const { modulesOutputDirectory, serviceConfig, mainComposeDocument } = context;

    context.command.log(
      [
        `${ux.colorize('yellow', 'Note')}: the Postgres database template is incomplete.`,
        'Update docker/modules/database-postgres/init-scripts/ with your schema (tables and publication) before deploying.',
        'Init scripts run only when the DB volume is empty. If you see "Publication powersync does not exist", run: ' +
          ux.colorize('blue', 'powersync docker stop --remove --remove-volumes') +
          ' then ' +
          ux.colorize('blue', 'powersync docker reset') +
          ' again.'
      ].join('\n')
    );

    const moduleOutputDirectory = path.join(modulesOutputDirectory, 'database-postgres');
    fs.mkdirSync(moduleOutputDirectory, { recursive: true });

    const databaseComposeFilePath = path.join(moduleOutputDirectory, 'postgres.database.compose.yaml');
    fs.copyFileSync(path.join(RESOURCES_DIR, 'postgres.database.compose.yaml'), databaseComposeFilePath);

    const initScriptsSrc = path.join(RESOURCES_DIR, 'init-scripts');
    const initScriptsDest = path.join(moduleOutputDirectory, 'init-scripts');
    fs.mkdirSync(initScriptsDest, { recursive: true });
    if (fs.existsSync(initScriptsSrc)) {
      fs.cpSync(initScriptsSrc, initScriptsDest, { recursive: true });
    }

    const includePath = path.relative(context.composeOutputDirectory, databaseComposeFilePath);
    (mainComposeDocument.get('include') as YAMLSeq).add(includePath);

    const servicesNode = mainComposeDocument.get('services');
    if (isMap(servicesNode)) {
      const powersyncServiceNode = servicesNode.get('powersync');
      if (isMap(powersyncServiceNode)) {
        const dependsOnNode = powersyncServiceNode.get('depends_on');
        if (isMap(dependsOnNode)) {
          dependsOnNode.set('pg-db', { condition: 'service_healthy' });
        }
      }
    }

    const uri = new Scalar('PS_DATA_SOURCE_URI');
    uri.type = 'PLAIN';
    uri.tag = '!env';

    const replicationConfig = {
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

    return { additionalEnviroment };
  }
};

export default PostgresSourceDatabaseModule;
