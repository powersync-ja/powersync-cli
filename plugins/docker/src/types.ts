import type { Command } from '@oclif/core';
import type { Document } from 'yaml';

export enum DockerModuleType {
  BACKEND = 'backend',
  STORAGE = 'storage',
  SOURCE_DATABASE = 'source_database'
}

export type DockerModuleContext = {
  /** Invoking command, for logging and output. */
  command: Command;
  projectDirectory: string;
  /** Directory containing docker-compose.yaml (powersync/docker/). Used for relative include paths. */
  composeOutputDirectory: string;
  modulesOutputDirectory: string;
  /** Main docker-compose document (docker/). Modules may add to include and services.powersync.depends_on. */
  mainComposeDocument: Document;
  serviceConfig: Document;
};

export type DockerModuleConfigResponse = {
  additionalEnvironment?: Record<string, string>;
};

export type DockerModule = {
  name: string;
  type: DockerModuleType;
  apply: (context: DockerModuleContext) => Promise<DockerModuleConfigResponse>;
};
