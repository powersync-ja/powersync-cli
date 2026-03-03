import { readFileSync } from 'node:fs';
import * as yaml from 'yaml';

export const YAML_SYNC_RULES_SCHEMA = /* yaml */ `
# Adds YAML Schema support for VSCode users with the YAML extension installed. This enables features like validation and autocompletion based on the provided schema.
# yaml-language-server: $schema=https://unpkg.com/@powersync/service-sync-rules@latest/schema/sync_rules.json
`.trim();

export const YAML_SERVICE_SCHEMA = /* yaml */ `
# Adds YAML Schema support for VSCode users with the YAML extension installed. This enables features like validation and autocompletion based on the provided schema.
# yaml-language-server: $schema=https://unpkg.com/@powersync/cli-schemas@latest/json-schema/service-config.json
`.trim();

export const YAML_CLI_SCHEMA = /* yaml */ `
# Adds YAML Schema support for VSCode users with the YAML extension installed. This enables features like validation and autocompletion based on the provided schema.
# yaml-language-server: $schema=https://unpkg.com/@powersync/cli-schemas@latest/json-schema/cli-config.json
`.trim();

/**
 * Custom YAML tag which performs string environment variable substitution
 * Allows for type casting string environment variables to boolean or number
 * by using the syntax !env PS_MONGO_PORT::number or !env PS_USE_SUPABASE::boolean
 */
export const YamlEnvTag: yaml.ScalarTag = {
  resolve(envName: string, onError: (error: string) => void) {
    const [name, type = 'string'] = envName.split('::');
    const value = process.env[name];
    if (value === undefined) {
      onError(
        `Attempted to substitute environment variable "${envName}" which is undefined. Set this variable on the environment.`
      );
      return envName;
    }

    switch (type) {
      case 'boolean': {
        if (value?.toLowerCase() === 'true') return true;
        if (value?.toLowerCase() === 'false') return false;
        onError(`Environment variable "${envName}" is not a boolean. Expected "true" or "false", got "${value}".`);
        return envName;
      }

      case 'number': {
        const numberValue = Number(value);
        if (Number.isNaN(numberValue)) {
          onError(`Environment variable "${envName}" is not a valid number. Got: "${value}".`);
          return envName;
        }

        return numberValue;
      }

      case 'string': {
        return value;
      }

      default: {
        onError(`Environment variable "${envName}" has an invalid type suffix "${type}".`);
        return envName;
      }
    }
  },
  tag: '!env'
};

const YAML_PARSE_OPTIONS = { customTags: [YamlEnvTag] };

/**
 * Parses a YAML document, evaluating !env tags.
 */
export function parseYamlFile(filePath: string): yaml.Document {
  const content = readFileSync(filePath, 'utf8');
  return yaml.parseDocument(content, YAML_PARSE_OPTIONS);
}

/**
 * Parse a YAML string without resolving !env, so the output can preserve the tag for runtime substitution
 * (e.g. when merging service snippets so the PowerSync container resolves !env from its env_file).
 */
export function parseYamlDocumentPreserveTags(content: string): yaml.Document {
  return yaml.parseDocument(content);
}

/**
 * Stringify a value to YAML. Use for writing config files so all YAML I/O goes through cli-core.
 */
export function stringifyYaml(value: unknown): string {
  return yaml.stringify(value);
}
