import AJV from 'ajv';
import ajvFormatter, { IOutputError } from 'better-ajv-errors';

import { CLIConfigSchema } from './CLIConfig.js';
import { ServiceCloudConfigSchema } from './ServiceCloudConfig.js';
import { ServiceConfigSchema } from './ServiceConfig.js';
import { ServiceSelfHostedConfigSchema } from './ServiceSelfHostedConfig.js';

export const CLOUD_CONFIG_VALIDATOR = createSchemaValidator(ServiceCloudConfigSchema);
export const SELF_HOSTED_CONFIG_VALIDATOR = createSchemaValidator(ServiceSelfHostedConfigSchema);
export const SERVICE_CONFIG_VALIDATOR = createSchemaValidator(ServiceConfigSchema);
export const CLI_CONFIG_VALIDATOR = createSchemaValidator(CLIConfigSchema);

/**
 * Validate cloud service config (service.yaml with _type: cloud) against the cloud JSON schema.
 */
export const validateCloudConfig = (config: unknown) => CLOUD_CONFIG_VALIDATOR.validate(config);

/**
 * Validate self-hosted service config (service.yaml with _type: self-hosted) against the self-hosted JSON schema.
 */
export const validateSelfHostedConfig = (config: unknown) => SELF_HOSTED_CONFIG_VALIDATOR.validate(config);

/**
 * Validate either cloud or self-hosted service config against the JSON schema (discriminated by _type).
 */
export const validateServiceConfig = (config: unknown) => SERVICE_CONFIG_VALIDATOR.validate(config);

/**
 * Validate CLI config (cli.yaml: cloud or self-hosted) against the CLI config JSON schema.
 */
export const validateCLIConfig = (config: unknown) => CLI_CONFIG_VALIDATOR.validate(config);

/**
 * Creates a validator that checks data against a JSON Schema using AJV.
 * Returns an object with a `validate(data)` method that returns
 * `{ valid: true }` or `{ valid: false, errors: string[] }`.
 *
 * @param schema - JSON Schema object (e.g. ServiceConfigSchema, CLIConfigSchema)
 * @returns Validator with validate(data) method
 */
export function createSchemaValidator(schema: Record<string, unknown>) {
  const ajv = new AJV.Ajv();
  const validator = ajv.compile(schema);
  return {
    validate(data: unknown) {
      const valid = validator(data);

      if (!valid) {
        const errors: string[] = ajvFormatter(schema, data, validator.errors || [], {
          format: 'js'
        })?.map((error: IOutputError) => error.error);

        return {
          errors: errors || [],
          valid: false
        };
      }

      return {
        valid: true
      };
    }
  };
}
