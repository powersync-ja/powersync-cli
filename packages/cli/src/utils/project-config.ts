import { existsSync, readFileSync } from 'node:fs';
import { Document, parseDocument } from 'yaml';
import { parseYamlFile } from './yaml.js';

/**
 * The filename of the link configuration file.
 */
export const LINK_FILENAME = 'link.yaml';

export const SERVICE_FILENAME = 'service.yaml';

export const SYNC_FILENAME = 'sync.yaml';

/**
 * Loads link.yaml as a YAML Document so it can be updated in place (preserving comments).
 * If the file does not exist, returns a new empty Document.
 */
export function loadLinkDocument(linkPath: string): Document {
  const content = existsSync(linkPath) ? readFileSync(linkPath, 'utf8') : '';
  const doc = content ? parseDocument(content) : new Document({});
  if (doc.contents === null) {
    doc.contents = doc.createNode({}) as Document['contents'];
  }
  return doc;
}

/**
 * Parses the service.yaml file as a YAML Document.
 */
export function loadServiceDocument(servicePath: string): Document {
  return parseYamlFile(servicePath);
}
