import AJV from 'ajv';
import AjvErrorFormatter from 'better-ajv-errors';
import { CLIConfigSchema } from './CLIConfig.js';
import { LinkConfigSchema } from './LinkConfig.js';
import { CLICloudConfigSchema } from './cloud.js';
import { CLISelfHostedConfigSchema } from './self-hosted.js';

export const CLOUD_CONFIG_VALIDATOR = createSchemaValidator(CLICloudConfigSchema);
export const SELF_HOSTED_CONFIG_VALIDATOR = createSchemaValidator(CLISelfHostedConfigSchema);
export const CLI_CONFIG_VALIDATOR = createSchemaValidator(CLIConfigSchema);
export const LINK_CONFIG_VALIDATOR = createSchemaValidator(LinkConfigSchema);

/**
 * Validate cloud service config (service.yaml with _type: cloud) against the cloud JSON schema.
 */
export const validateCloudConfig = (config: any) => {
  return CLOUD_CONFIG_VALIDATOR.validate(config);
};

/**
 * Validate self-hosted service config (service.yaml with _type: self-hosted) against the self-hosted JSON schema.
 */
export const validateSelfHostedConfig = (config: any) => {
  return SELF_HOSTED_CONFIG_VALIDATOR.validate(config);
};

/**
 * Validate either cloud or self-hosted config against the JSON schema (discriminated by _type).
 */
export const validateCLIConfig = (config: any) => {
  return CLI_CONFIG_VALIDATOR.validate(config);
};

/**
 * Validate link config (link.yaml: cloud or self-hosted) against the link JSON schema.
 */
export const validateLinkConfig = (config: any) => {
  return LINK_CONFIG_VALIDATOR.validate(config);
};

/**
 * Creates a validator that checks data against a JSON Schema using AJV.
 * Returns an object with a `validate(data)` method that returns
 * `{ valid: true }` or `{ valid: false, errors: string[] }`.
 *
 * @param schema - JSON Schema object (e.g. CLIConfigSchema, LinkConfigSchema)
 * @returns Validator with validate(data) method
 */
export function createSchemaValidator(schema: Record<string, unknown>) {
  const ajv = new AJV.Ajv();
  const validator = ajv.compile(schema);
  return {
    validate: (data: any) => {
      const valid = validator(data);

      if (!valid) {
        const errors = AjvErrorFormatter(schema, data, validator.errors || [], {
          format: 'js'
        })?.map((error: any) => error.error);

        return {
          valid: false,
          errors: errors || []
        };
      }

      return {
        valid: true
      };
    }
  };
}
