import { existsSync, readFileSync } from 'node:fs';
import { Document, parseDocument } from 'yaml';
import { parseYamlFile } from './yaml.js';

/**
 * The filename of the link configuration file.
 */
export const LINK_FILENAME = 'link.yaml';

export const SERVICE_FILENAME = 'service.yaml';

/** Written by `fetch config` when service.yaml already exists; user should manually merge into service.yaml. */
export const SERVICE_FETCHED_FILENAME = 'service-fetched.yaml';

export const SYNC_FILENAME = 'sync.yaml';

/** Written by `fetch config` when sync.yaml already exists; user should manually merge into sync.yaml. */
export const SYNC_FETCHED_FILENAME = 'sync-fetched.yaml';

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
