import { DockerModule, DockerModuleType } from '../types.js';
import ExternalBucketStorageModule from './bucket-storage/external/ExternalBucketStorageModule.js';
import PostgresBucketStorageModule from './bucket-storage/postgres/PostgresBucketStorageModule.js';
import ExternalSourceDatabaseModule from './source-database/external/ExternalSourceDatabaseModule.js';
import PostgresSourceDatabaseModule from './source-database/postgres/PostgresSourceDatabaseModule.js';

export const TEMPLATES: Record<DockerModuleType, DockerModule[]> = {
  [DockerModuleType.BACKEND]: [],
  [DockerModuleType.STORAGE]: [PostgresBucketStorageModule, ExternalBucketStorageModule],
  [DockerModuleType.SOURCE_DATABASE]: [PostgresSourceDatabaseModule, ExternalSourceDatabaseModule]
};
