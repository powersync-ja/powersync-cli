import { CLICloudConfigSchema } from './cloud.js';
import { CLISelfHostedConfigSchema } from './self-hosted.js';

/** JSON Schema for CLI config: discriminated union on _type ('cloud' | 'self-hosted'). */
export const CLIConfigSchema = {
  oneOf: [CLICloudConfigSchema, CLISelfHostedConfigSchema]
} as const;
