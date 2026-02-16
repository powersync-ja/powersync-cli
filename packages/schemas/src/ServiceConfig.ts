import { ServiceCloudConfigSchema } from './cloud.js';
import { ServiceSelfHostedConfigSchema } from './self-hosted.js';

/** JSON Schema for service config: discriminated union on _type ('cloud' | 'self-hosted'). */
export const ServiceConfigSchema = {
  oneOf: [ServiceCloudConfigSchema, ServiceSelfHostedConfigSchema]
} as const;
