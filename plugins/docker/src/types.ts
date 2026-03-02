import type { Command } from '@oclif/core';
import type { Document } from 'yaml';

export enum DockerModuleType {
  BACKEND = 'backend',
  SOURCE_DATABASE = 'source_database',
  STORAGE = 'storage'
}

export type DockerModuleContext = {
  /** Invoking command, for logging and output. */
  command: Command;
  /** Directory containing docker-compose.yaml (powersync/docker/). Used for relative include paths. */
  composeOutputDirectory: string;
  /** Main docker-compose document (docker/). Modules may add to include and services.powersync.depends_on. */
  mainComposeDocument: Document;
  modulesOutputDirectory: string;
  projectDirectory: string;
  serviceConfig: Document;
};

export type DockerModuleConfigResponse = {
  additionalEnvironment?: Record<string, string>;
};

export type DockerModule = {
  apply: (context: DockerModuleContext) => Promise<DockerModuleConfigResponse>;
  name: string;
  type: DockerModuleType;
};
