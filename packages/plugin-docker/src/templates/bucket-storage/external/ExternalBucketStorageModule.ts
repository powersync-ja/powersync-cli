import { MergedServiceConfig } from '@powersync/service-schema';
import { Scalar } from 'yaml';
import { DockerModule, DockerModuleContext, DockerModuleType } from '../../../types.js';

const ExternalBucketStorageModule: DockerModule = {
  name: 'external',
  type: DockerModuleType.STORAGE,
  apply: async (context: DockerModuleContext) => {
    const { serviceConfig } = context;

    context.command.log(
      'Using external bucket storage. Set PS_STORAGE_SOURCE_URI in docker/.env to your PostgreSQL connection string before deploying.'
    );

    const uri = new Scalar('PS_STORAGE_SOURCE_URI');
    uri.type = 'PLAIN';
    uri.tag = '!env';

    const storageConfig: MergedServiceConfig['storage'] = {
      type: 'postgresql',
      uri,
      sslmode: 'disable'
    };

    serviceConfig.set('storage', storageConfig);

    const additionalEnviroment = {
      PS_STORAGE_SOURCE_URI: '<set-your-external-postgres-connection-string-in-env>'
    };

    return { additionalEnviroment };
  }
};

export default ExternalBucketStorageModule;
