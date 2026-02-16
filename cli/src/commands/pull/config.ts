import { ux } from '@oclif/core';
import { ServiceCloudConfig } from '@powersync/cli-schemas';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as t from 'ts-codec';
import { Document, isMap, type Node, type Pair, parseDocument, YAMLMap } from 'yaml';

import {
  CloudInstanceCommand,
  ensureServiceTypeMatches,
  CLI_FILENAME,
  SERVICE_FILENAME,
  ServiceType,
  SYNC_FILENAME
} from '@powersync/cli-core';
import { fetchCloudConfig } from '../../api/cloud/fetch-cloud-config.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';

const SERVICE_FETCHED_FILENAME = 'service-fetched.yaml';
const SYNC_FETCHED_FILENAME = 'sync-fetched.yaml';

const PULL_CONFIG_HEADER = `# PowerSync Cloud config (fetched from cloud)
# yaml-language-server: $schema=https://unpkg.com/@powersync/cli-schemas@latest/json-schema/service-config.json
#
`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLOUD_SERVICE_TEMPLATE_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'templates',
  'cloud',
  'powersync',
  'service.yaml'
);

type JSONSchemaObject = {
  description?: string;
  properties?: Record<string, JSONSchemaObject>;
  items?: JSONSchemaObject;
};

function pairKey(pair: Pair<unknown, unknown>): string | undefined {
  const k = pair.key as { value?: string } | undefined;
  return k?.value;
}

/** Find the Pair node for a top-level key in a parsed YAML map. */
function findMapPair(contents: unknown, key: string): Pair<unknown, unknown> | null {
  if (!contents || typeof (contents as { items?: unknown[] }).items !== 'object') return null;
  const items = (contents as { items: Pair<unknown, unknown>[] }).items;
  const pair = items.find((p) => pairKey(p) === key);
  return pair ?? null;
}

/** Index of the pair with the given key in the map's items, or -1. */
function findMapPairIndex(map: YAMLMap, key: string): number {
  const items = map.items ?? [];
  return items.findIndex((p) => pairKey(p) === key);
}

/** Insert a pair into the map at the given index (or append if index >= items.length). */
function insertPair(map: YAMLMap, index: number, pair: Pair<unknown, unknown>): void {
  const items = map.items ?? [];
  if (index < 0 || index >= items.length) {
    items.push(pair);
  } else {
    items.splice(index, 0, pair);
  }
}

function hasSection(config: t.Decoded<typeof ServiceCloudConfig>, key: 'replication' | 'client_auth'): boolean {
  const c = config as Record<string, unknown>;
  return c[key] !== undefined && c[key] !== null;
}

function formatServiceYamlWithComments(config: t.Decoded<typeof ServiceCloudConfig>): string {
  let schema: JSONSchemaObject;
  try {
    schema = (t.generateJSONSchema(ServiceCloudConfig) as JSONSchemaObject) ?? {};
  } catch {
    schema = {};
  }

  function getDescriptionFromSchema(s: JSONSchemaObject | undefined, path: string[]): string | undefined {
    if (!s || path.length === 0) return s?.description;
    const [head, ...rest] = path;
    const next = s.properties?.[head];
    return rest.length === 0 ? next?.description : getDescriptionFromSchema(next, rest);
  }

  function setCommentsOnMap(
    map: { items: Array<{ key: unknown; value: unknown }> },
    s: JSONSchemaObject | undefined,
    path: string[]
  ): void {
    if (!s?.properties) return;
    for (const pair of map.items) {
      const keyStr =
        typeof pair.key === 'object' && pair.key !== null && 'value' in pair.key
          ? String((pair.key as { value: unknown }).value)
          : String(pair.key);
      const keyPath = [...path, keyStr];
      const desc = getDescriptionFromSchema(s, keyPath);
      const value = pair.value as { commentBefore?: string | null; items?: unknown[] };
      if (value && typeof value === 'object' && desc) {
        value.commentBefore = desc;
      }
      if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) {
        const subSchema = s.properties?.[keyStr];
        const innerMap = value as { items: Array<{ key: unknown; value: unknown }> };
        setCommentsOnMap(innerMap, subSchema, keyPath);
      }
    }
  }

  const doc = new Document(config);
  const contents = doc.contents as { items?: Array<{ key: unknown; value: unknown }> } | null;
  if (contents && typeof contents === 'object' && Array.isArray(contents.items) && contents.items.length > 0) {
    setCommentsOnMap({ items: contents.items }, Object.keys(schema).length > 0 ? schema : undefined, []);
  }

  let templateDoc: ReturnType<typeof parseDocument> | null = null;
  try {
    templateDoc = parseDocument(readFileSync(CLOUD_SERVICE_TEMPLATE_PATH, 'utf8'));
  } catch {
    // template missing or parse failed
  }

  if (templateDoc?.contents && isMap(doc.contents)) {
    const outMap = doc.contents as YAMLMap;
    const templateMap = templateDoc.contents as YAMLMap;
    const replicationPair = findMapPair(templateMap, 'replication');
    const clientAuthPair = findMapPair(templateMap, 'client_auth');

    const rep = config.replication as { connections?: unknown[] } | undefined;
    const useTemplateReplication = !rep || !Array.isArray(rep.connections) || rep.connections.length === 0;
    if (useTemplateReplication && replicationPair) {
      const repIdx = findMapPairIndex(outMap, 'replication');
      if (repIdx >= 0) {
        outMap.items[repIdx] = replicationPair;
      } else {
        const regionIdx = findMapPairIndex(outMap, 'region');
        insertPair(outMap, regionIdx >= 0 ? regionIdx + 1 : 0, replicationPair);
      }
    }

    if (!hasSection(config, 'client_auth') && clientAuthPair) {
      insertPair(outMap, outMap.items?.length ?? 0, clientAuthPair);
    }
  }

  let out = PULL_CONFIG_HEADER + doc.toString();

  if (hasSection(config, 'client_auth') && templateDoc?.contents) {
    const templateMap = templateDoc.contents as YAMLMap;
    const clientAuthPair = findMapPair(templateMap, 'client_auth');
    if (clientAuthPair?.value != null) {
      const commentDoc = new Document();
      commentDoc.contents = clientAuthPair.value as Node;
      out = out.replace(/\n?$/, '\n') + commentDoc.toString().replace(/\n$/, '');
    }
  }

  return out;
}

export default class PullConfig extends CloudInstanceCommand {
  static description =
    'Fetch instance config and sync rules from PowerSync Cloud and write to service.yaml and sync.yaml in the config directory. Writes cli.yaml if you pass --instance-id, --org-id, --project-id. Cloud only.';
  static summary = 'Download Cloud config and sync rules into local service.yaml and sync.yaml.';

  static flags = {
    ...CloudInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PullConfig);
    const { directory, 'instance-id': instanceId, 'org-id': orgId, 'project-id': projectId } = flags;

    const projectDir = this.resolveProjectDir(flags);
    if (!existsSync(projectDir)) {
      if (instanceId && orgId && projectId) {
        mkdirSync(projectDir, { recursive: true });
      } else {
        this.styledError({
          message: `Directory "${directory}" not found. Run ${ux.colorize('blue', 'powersync init cloud')} first, or pass --instance-id, --org-id, and --project-id to create and link.`
        });
      }
    }
    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: ServiceType.CLOUD,
      projectDir
    });

    const linkPath = join(projectDir, CLI_FILENAME);
    if (!existsSync(linkPath)) {
      if (!instanceId || !orgId || !projectId) {
        this.styledError({
          message: `Linking is required. Either run ${ux.colorize('blue', 'powersync link cloud --instance-id=<id> --org-id=<id> --project-id=<id>')} first, or pass --instance-id, --org-id, and --project-id to this command.`
        });
      }
      writeCloudLink(projectDir, { instanceId, orgId, projectId });
      this.log(ux.colorize('green', `Created ${directory}/${CLI_FILENAME} with Cloud instance link.`));
    }

    const { linked } = this.loadProject(flags);
    const client = await this.getClient();

    this.log(
      ux.colorize(
        'cyan',
        `Fetching config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}...`
      )
    );

    const fetched = await fetchCloudConfig(client, linked).catch((error) => {
      this.styledError({
        message: `Failed to fetch config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`,
        error
      });
    });

    const serviceExists = existsSync(join(projectDir, SERVICE_FILENAME));
    const syncExists = existsSync(join(projectDir, SYNC_FILENAME));
    if (serviceExists) {
      this.warn(
        ux.colorize(
          'yellow',
          `${SERVICE_FILENAME} already exists. Writing to service-fetched.yaml instead. Manually merge the settings into ${SERVICE_FILENAME} as needed.`
        )
      );
    }
    if (syncExists && fetched.syncRules) {
      this.warn(
        ux.colorize(
          'yellow',
          `${SYNC_FILENAME} already exists. Writing to sync-fetched.yaml instead. Manually merge the sync rules into ${SYNC_FILENAME} as needed.`
        )
      );
    }
    const serviceYaml = formatServiceYamlWithComments(fetched.config);
    const serviceOutputName = serviceExists ? SERVICE_FETCHED_FILENAME : SERVICE_FILENAME;
    const serviceOutputPath = join(projectDir, serviceOutputName);
    writeFileSync(serviceOutputPath, serviceYaml, 'utf8');
    this.log(ux.colorize('green', `Wrote ${serviceOutputName} with config from the cloud.`));

    if (typeof fetched.syncRules === 'string') {
      const syncOutputName = syncExists ? SYNC_FETCHED_FILENAME : SYNC_FILENAME;
      const syncOutputPath = join(projectDir, syncOutputName);
      writeFileSync(syncOutputPath, fetched.syncRules, 'utf8');
      this.log(ux.colorize('green', `Wrote ${syncOutputName} with sync rules from the cloud.`));
    }
  }
}
