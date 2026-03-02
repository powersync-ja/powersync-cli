import SelfHostedSchema from '@powersync/service-schema/schema.json' with { type: 'json' };
import { configFile } from '@powersync/service-types';
import * as t from 'ts-codec';

/** Merges two JSON Schema object schemas by combining properties and required arrays. */
function mergeObjectSchemas(
  base: Record<string, unknown>,
  extension: Record<string, unknown>
): Record<string, unknown> {
  const baseProps = (base.properties as Record<string, unknown>) ?? {};
  const extProps = (extension.properties as Record<string, unknown>) ?? {};
  const baseRequired = Array.isArray(base.required) ? (base.required as string[]) : [];
  const extRequired = Array.isArray(extension.required) ? (extension.required as string[]) : [];
  const required = [...new Set([...baseRequired, ...extRequired])];
  return {
    ...base,
    properties: { ...baseProps, ...extProps },
    type: 'object',
    ...(required.length > 0 ? { required } : {})
  };
}

// For self hosted, we use the json schema as a merged source of truth
export const BaseServiceSelfHostedConfig = configFile.powerSyncConfig.and(
  t.object({
    _type: t.literal('self-hosted')
  })
);
export type BaseServiceSelfHostedConfig = t.Encoded<typeof BaseServiceSelfHostedConfig>;
export type BaseServiceSelfHostedConfigDecoded = t.Decoded<typeof BaseServiceSelfHostedConfig>;

export const ServiceSelfHostedConfig = BaseServiceSelfHostedConfig.and(t.record(t.any));
export type ServiceSelfHostedConfig = t.Encoded<typeof ServiceSelfHostedConfig>;
export type ServiceSelfHostedConfigDecoded = t.Decoded<typeof ServiceSelfHostedConfig>;

const BaseServiceSelfHostedConfigSchema = t.generateJSONSchema(BaseServiceSelfHostedConfig, {
  parsers: [configFile.portParser]
});

/** JSON Schema for self-hosted service config: BaseServiceSelfHostedConfig + SelfHostedSchema (management-types). */
export const ServiceSelfHostedConfigSchema = mergeObjectSchemas(
  BaseServiceSelfHostedConfigSchema as Record<string, unknown>,
  SelfHostedSchema as Record<string, unknown>
);
