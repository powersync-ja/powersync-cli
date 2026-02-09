import { MergedServiceConfig } from '@powersync/service-schema';
import { Scalar } from 'yaml';
import { DockerModule, DockerModuleContext, DockerModuleType } from '../../../types.js';

const ExternalSourceDatabaseModule: DockerModule = {
  name: 'external',
  type: DockerModuleType.SOURCE_DATABASE,
  apply: async (context: DockerModuleContext) => {
    const { serviceConfig } = context;

    context.command.log(
      'Using external replication database. Set PS_DATA_SOURCE_URI in docker/.env to your PostgreSQL connection string before deploying.'
    );

    const uri = new Scalar('PS_DATA_SOURCE_URI');
    uri.type = 'PLAIN';
    uri.tag = '!env';

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
      PS_DATA_SOURCE_URI: '<set-your-external-postgres-connection-string-in-env>'
    };

    return { additionalEnviroment };
  }
};

export default ExternalSourceDatabaseModule;
