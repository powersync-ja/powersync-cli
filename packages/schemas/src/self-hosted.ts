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
    type: 'object',
    properties: { ...baseProps, ...extProps },
    ...(required.length > 0 ? { required } : {})
  };
}

// For self hosted, we use the json schema as a merged source of truth
export const BaseCLISelfHostedConfig = configFile.powerSyncConfig.and(
  t.object({
    _type: t.literal('self-hosted')
  })
);
export type BaseCLISelfHostedConfig = t.Encoded<typeof BaseCLISelfHostedConfig>;
export type BaseCLISelfHostedConfigDecoded = t.Decoded<typeof BaseCLISelfHostedConfig>;

export const CLISelfHostedConfig = BaseCLISelfHostedConfig.and(t.record(t.any));
export type CLISelfHostedConfig = t.Encoded<typeof CLISelfHostedConfig>;
export type CLISelfHostedConfigDecoded = t.Decoded<typeof CLISelfHostedConfig>;

const BaseCLISelfHostedConfigSchema = t.generateJSONSchema(BaseCLISelfHostedConfig, {
  parsers: [configFile.portParser]
});

/** JSON Schema for self-hosted CLI config: BaseCLISelfHostedConfig + SelfHostedSchema (management-types). */
export const CLISelfHostedConfigSchema = mergeObjectSchemas(
  BaseCLISelfHostedConfigSchema as Record<string, unknown>,
  SelfHostedSchema as Record<string, unknown>
);
