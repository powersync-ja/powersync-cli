import { Scalar } from 'yaml';

import { DockerModule, DockerModuleContext, DockerModuleType } from '../../../types.js';

const ExternalBucketStorageModule: DockerModule = {
  async apply(context: DockerModuleContext) {
    const { serviceConfig } = context;

    context.command.log(
      'Using external bucket storage. Set PS_STORAGE_SOURCE_URI in docker/.env to your PostgreSQL connection string before deploying.'
    );

    const uri = new Scalar('PS_STORAGE_SOURCE_URI');
    uri.type = 'PLAIN';
    uri.tag = '!env';

    const storageConfig = {
      sslmode: 'disable',
      type: 'postgresql',
      uri
    };

    serviceConfig.set('storage', storageConfig);

    const additionalEnvironment = {
      PS_STORAGE_SOURCE_URI: '<set-your-external-postgres-connection-string-in-env>'
    };

    return { additionalEnvironment };
  },
  name: 'external',
  type: DockerModuleType.STORAGE
};

export default ExternalBucketStorageModule;
