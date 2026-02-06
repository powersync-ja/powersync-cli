import { parseYamlFile } from './yaml.js';

export const LINK_FILENAME = 'link.yaml';
export const SERVICE_FILENAME = 'service.yaml';

/**
 * Parses the service.yaml file as a YAML Document.
 */
export function loadServiceDocument(servicePath: string): ReturnType<typeof parseYamlFile> {
  return parseYamlFile(servicePath);
}
