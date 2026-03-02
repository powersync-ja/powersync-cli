import { ServiceCloudConfigSchema } from './ServiceCloudConfig.js';
import { ServiceSelfHostedConfigSchema } from './ServiceSelfHostedConfig.js';

/** JSON Schema for service config: discriminated union on _type ('cloud' | 'self-hosted'). */
export const ServiceConfigSchema = {
  oneOf: [ServiceCloudConfigSchema, ServiceSelfHostedConfigSchema]
} as const;
