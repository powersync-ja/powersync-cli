import { ux } from '@oclif/core';
import path from 'node:path';
import { Scalar } from 'yaml';
import { DockerModule, DockerModuleContext, DockerModuleType } from '../../../types.js';

const ExternalSourceDatabaseModule: DockerModule = {
  name: 'external',
  type: DockerModuleType.SOURCE_DATABASE,
  apply: async (context: DockerModuleContext) => {
    const { projectDirectory: projectdirectory, serviceConfig } = context;

    context.command.log(
      ux.colorize(
        'yellow',
        `Using external replication database. Set PS_DATA_SOURCE_URI in ${path.join(projectdirectory, 'docker', '.env')} to your PostgreSQL connection string before deploying.`
      )
    );

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

    const additionalEnvironment = {
      PS_DATA_SOURCE_URI: '<set-your-external-postgres-connection-string-in-env>'
    };

    return { additionalEnvironment };
  }
};

export default ExternalSourceDatabaseModule;
