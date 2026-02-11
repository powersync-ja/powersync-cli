import { readFileSync } from 'node:fs';
import * as yaml from 'yaml';

/**
 * Custom YAML tag which performs string environment variable substitution
 * Allows for type casting string environment variables to boolean or number
 * by using the syntax !env PS_MONGO_PORT::number or !env PS_USE_SUPABASE::boolean
 */
export const YamlEnvTag: yaml.ScalarTag = {
  tag: '!env',
  resolve(envName: string, onError: (error: string) => void) {
    const [name, type = 'string'] = envName.split('::');
    let value = process.env[name];
    if (typeof value == 'undefined') {
      onError(
        `Attempted to substitute environment variable "${envName}" which is undefined. Set this variable on the environment.`
      );
      return envName;
    }
    switch (type) {
      case 'string':
        return value;
      case 'number': {
        const numberValue = Number(value);
        if (Number.isNaN(numberValue)) {
          onError(`Environment variable "${envName}" is not a valid number. Got: "${value}".`);
          return envName;
        }
        return numberValue;
      }
      case 'boolean':
        if (value?.toLowerCase() == 'true') return true;
        if (value?.toLowerCase() == 'false') return false;
        onError(`Environment variable "${envName}" is not a boolean. Expected "true" or "false", got "${value}".`);
        return envName;
      default:
        onError(`Environment variable "${envName}" has an invalid type suffix "${type}".`);
        return envName;
    }
  }
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
