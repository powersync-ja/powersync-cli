import { ux } from '@oclif/core';
import { CLICloudConfig } from '@powersync/cli-schemas';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as t from 'ts-codec';
import { Document } from 'yaml';

import { fetchCloudConfig } from '../../api/cloud/fetch-cloud-config.js';
import { writeCloudLink } from '../../api/cloud/write-cloud-link.js';
import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';
import { ensureServiceTypeMatches } from '../../utils/ensureServiceType.js';
import {
  LINK_FILENAME,
  SERVICE_FETCHED_FILENAME,
  SERVICE_FILENAME,
  SYNC_FETCHED_FILENAME,
  SYNC_FILENAME
} from '../../utils/project-config.js';

type JSONSchemaObject = {
  description?: string;
  properties?: Record<string, JSONSchemaObject>;
  items?: JSONSchemaObject;
};

function getDescriptionFromSchema(schema: JSONSchemaObject | undefined, path: string[]): string | undefined {
  if (!schema || path.length === 0) return schema?.description;
  const [head, ...rest] = path;
  const next = schema.properties?.[head];
  return rest.length === 0 ? next?.description : getDescriptionFromSchema(next, rest);
}

function setCommentsOnMap(
  map: { items: Array<{ key: unknown; value: unknown }> },
  schema: JSONSchemaObject | undefined,
  path: string[]
): void {
  if (!schema?.properties) return;
  for (const pair of map.items) {
    const keyStr =
      typeof pair.key === 'object' && pair.key !== null && 'value' in pair.key
        ? String((pair.key as { value: unknown }).value)
        : String(pair.key);
    const keyPath = [...path, keyStr];
    const desc = getDescriptionFromSchema(schema, keyPath);
    const value = pair.value as { commentBefore?: string | null; items?: unknown[] };
    if (value && typeof value === 'object' && desc) {
      value.commentBefore = desc;
    }
    if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown[] }).items)) {
      const subSchema = schema.properties?.[keyStr];
      const innerMap = value as { items: Array<{ key: unknown; value: unknown }> };
      setCommentsOnMap(innerMap, subSchema, keyPath);
    }
  }
}

const PULL_CONFIG_HEADER = `# PowerSync Cloud config (fetched from cloud)
# yaml-language-server: $schema=https://unpkg.com/@powersync/cli-schemas@latest/json-schema/cli-config.json
#
`;

function getSchema(): JSONSchemaObject {
  try {
    return (t.generateJSONSchema(CLICloudConfig) as JSONSchemaObject) ?? {};
  } catch {
    return {};
  }
}

function formatServiceYamlWithComments(config: t.Decoded<typeof CLICloudConfig>): string {
  const schema = getSchema();
  const doc = new Document(config);
  const contents = doc.contents as { items?: Array<{ key: unknown; value: unknown }> } | null;
  if (contents && typeof contents === 'object' && Array.isArray(contents.items) && contents.items.length > 0) {
    setCommentsOnMap({ items: contents.items }, Object.keys(schema).length > 0 ? schema : undefined, []);
  }
  return PULL_CONFIG_HEADER + doc.toString();
}

export default class PullConfig extends CloudInstanceCommand {
  static description =
    'Fetch instance config and sync rules from PowerSync Cloud and write to service.yaml and sync.yaml in the config directory. Writes link.yaml if you pass --instance-id, --org-id, --project-id. Cloud only.';
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
          message: `Directory "${directory}" not found. Run ${ux.colorize('blue', 'powersync init')} first, or pass --instance-id, --org-id, and --project-id to create and link.`
        });
      }
    }
    ensureServiceTypeMatches({
      command: this,
      configRequired: false,
      directoryLabel: directory,
      expectedType: 'cloud',
      projectDir
    });

    const linkPath = join(projectDir, LINK_FILENAME);
    if (!existsSync(linkPath)) {
      if (!instanceId || !orgId || !projectId) {
        this.styledError({
          message: `Linking is required. Either run ${ux.colorize('blue', 'powersync link cloud --instance-id=<id> --org-id=<id> --project-id=<id>')} first, or pass --instance-id, --org-id, and --project-id to this command.`
        });
      }
      writeCloudLink(projectDir, { instanceId, orgId, projectId });
      this.log(ux.colorize('green', `Created ${directory}/${LINK_FILENAME} with Cloud instance link.`));
    }

    const { linked } = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });
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
