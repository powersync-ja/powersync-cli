import type { Document } from 'yaml';

export enum DockerModuleType {
  BACKEND = 'backend',
  STORAGE = 'storage',
  SOURCE_DATABASE = 'source_database'
}

export type DockerModuleContext = {
  projectdirectory: string;
  modulesOutputDirectory: string;
  serviceConfig: Document;
};

export type DockerModuleConfigResponse = {
  additionalEnviroment?: Record<string, string>;
  dockerIncludePaths?: string[];
  /** Service names from this module's compose (for main compose depends_on). */
  dockerServiceNames?: string[];
};

export type DockerModule = {
  name: string;
  type: DockerModuleType;
  apply: (context: DockerModuleContext) => Promise<DockerModuleConfigResponse>;
};
