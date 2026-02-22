import ServiceSchema from '@powersync/cli-schemas/service-config-schema.json' with { type: 'json' };
import SyncConfigSchema from '@powersync/cli-schemas/sync-config-schema.json' with { type: 'json' };

/**
 * JSON Schema for YAML files, used for validation and editor features like autocompletion.
 * We don't import the filenames since the OCLIF packages are difficult to separate client-side.
 */
export const YAML_SCHEMAS = {
  ['service.yaml']: ServiceSchema,
  ['sync.yaml']: SyncConfigSchema
};
