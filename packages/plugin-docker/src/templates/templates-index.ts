import { DockerModule, DockerModuleType } from '../types.js';
import PostgresBucketStorageModule from './bucket-storage/postgres/PostgresBucketStorageModule.js';
import PostgresSourceDatabaseModule from './source-database/postgres/PostgresSourceDatabaseModule.js';

export const TEMPLATES: Record<DockerModuleType, DockerModule[]> = {
  [DockerModuleType.BACKEND]: [],
  [DockerModuleType.STORAGE]: [PostgresBucketStorageModule],
  [DockerModuleType.SOURCE_DATABASE]: [PostgresSourceDatabaseModule]
};
