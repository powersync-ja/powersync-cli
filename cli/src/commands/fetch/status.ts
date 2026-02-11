import { Flags, ux } from '@oclif/core';
import { routes } from '@powersync/management-types';
import { Document } from 'yaml';

import { createCloudClient } from '../../clients/CloudClient.js';
import { createSelfHostedClient } from '../../clients/SelfHostedClient.js';
import { CloudProject } from '../../command-types/CloudInstanceCommand.js';
import { SelfHostedProject } from '../../command-types/SelfHostedInstanceCommand.js';
import { SharedInstanceCommand } from '../../command-types/SharedInstanceCommand.js';

type DiagnosticsResponse = routes.InstanceDiagnosticsResponse;
type SyncRulesSection = NonNullable<DiagnosticsResponse['active_sync_rules']>;

const INDENT = '  ';
const BULLET = '•';

function pad(level: number): string {
  return INDENT.repeat(level);
}

/** Format a date value as "ISO (local)" for human output. Returns raw value if not parseable. */
function formatDate(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toISOString()} (${date.toLocaleString()})`;
}

function formatErrors(errors: Array<{ level: string; message: string; ts?: string }>, indentLevel: number): string {
  if (!errors?.length) return '';
  const p = pad(indentLevel);
  return errors.map((e) => `${p}${BULLET} [${e.level}] ${e.message}${e.ts ? ` (${e.ts})` : ''}`).join('\n');
}

function formatConnectionsSection(connections: DiagnosticsResponse['connections'], indentLevel: number): string {
  if (!connections?.length) return `${pad(indentLevel)}(no connections)\n`;
  const p = pad(indentLevel);
  const lines: string[] = [];
  for (const conn of connections) {
    const status = conn.connected ? 'connected' : 'disconnected';
    lines.push(`${p}${BULLET} ${conn.id}`);
    lines.push(`${p}  Postgres URI: ${conn.postgres_uri ?? '—'}`);
    lines.push(`${p}  Status: ${status}`);
    if (conn.errors?.length) {
      lines.push(`${p}  Errors:`);
      lines.push(formatErrors(conn.errors, indentLevel + 2));
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

function formatSyncRulesSection(section: SyncRulesSection, indentLevel: number): string {
  const p = pad(indentLevel);
  const lines: string[] = [];

  if (section.errors?.length) {
    lines.push(`${p}Errors:`);
    lines.push(formatErrors(section.errors, indentLevel + 1));
    lines.push('');
  }

  if (section.connections?.length) {
    lines.push(`${p}Connections:`);
    for (const conn of section.connections) {
      lines.push(`${p}  ${BULLET} ${conn.tag ?? conn.id} (slot: ${conn.slot_name ?? '—'})`);
      lines.push(`${p}    Initial replication done: ${conn.initial_replication_done}`);
      if (conn.last_lsn != null) lines.push(`${p}    Last LSN: ${conn.last_lsn}`);
      if (conn.last_keepalive_ts != null) lines.push(`${p}    Last keepalive: ${formatDate(conn.last_keepalive_ts)}`);
      if (conn.last_checkpoint_ts != null)
        lines.push(`${p}    Last checkpoint: ${formatDate(conn.last_checkpoint_ts)}`);
      if (conn.replication_lag_bytes != null)
        lines.push(`${p}    Replication lag: ${conn.replication_lag_bytes} bytes`);
      if (conn.tables?.length) {
        lines.push(`${p}    Tables:`);
        for (const table of conn.tables) {
          const name = `${table.schema}.${table.name}`;
          const repl = table.replication_id?.length ? table.replication_id.join(', ') : '—';
          lines.push(`${p}      - ${name} (replication_id: ${repl})`);
          if (table.data_queries != null) lines.push(`${p}        data_queries: ${table.data_queries}`);
          if (table.parameter_queries != null) lines.push(`${p}        parameter_queries: ${table.parameter_queries}`);
          if (table.errors?.length) lines.push(formatErrors(table.errors, indentLevel + 3));
        }
      }
    }
    lines.push('');
  }

  if (section.content != null && section.content !== '') {
    lines.push(`${p}Content:`);
    lines.push(`${p}  ${section.content.split('\n').join(`\n${p}  `)}`);
  }

  return lines.join('\n').trimEnd() || `${p}(no data)\n`;
}

function formatDiagnosticsHuman(diagnostics: DiagnosticsResponse): string {
  const sections: string[] = [];

  sections.push('═══ Connections ═══');
  sections.push(formatConnectionsSection(diagnostics.connections ?? [], 0));

  if (diagnostics.active_sync_rules != null) {
    sections.push('═══ Active Sync Rules ═══');
    sections.push(formatSyncRulesSection(diagnostics.active_sync_rules, 0));
  }

  if (diagnostics.deploying_sync_rules != null) {
    sections.push('═══ Deploying Sync Rules ═══');
    sections.push(formatSyncRulesSection(diagnostics.deploying_sync_rules, 0));
  }

  return sections.join('\n').trimEnd();
}

export default class FetchStatus extends SharedInstanceCommand {
  static description =
    'Fetch instance diagnostics: connection status, active and deploying sync rules, replication state. Output as human-readable, JSON, or YAML. Cloud and self-hosted.';
  static summary = 'Show instance diagnostics (connections, sync rules, replication).';

  static flags = {
    output: Flags.string({
      default: 'human',
      description: 'Output format: human-readable, json, or yaml.',
      options: ['human', 'json', 'yaml']
    }),
    ...SharedInstanceCommand.flags
  };

  async getCloudStatus(project: CloudProject): Promise<DiagnosticsResponse> {
    const { linked } = project;
    const client = await createCloudClient();
    return client.getInstanceDiagnostics({
      app_id: linked.project_id,
      org_id: linked.org_id,
      id: linked.instance_id
    });
  }

  async getSelfHostedStatus(project: SelfHostedProject): Promise<DiagnosticsResponse> {
    const { linked } = project;
    const client = createSelfHostedClient({
      apiUrl: linked.api_url,
      apiKey: linked.api_key
    });
    return client.diagnostics({});
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(FetchStatus);

    const project = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });

    try {
      const diagnostics = await (project.linked.type === 'cloud'
        ? this.getCloudStatus(project as CloudProject)
        : this.getSelfHostedStatus(project as SelfHostedProject));

      if (flags.output === 'json') {
        this.log(ux.colorize('gray', JSON.stringify(diagnostics, null, 2)));
        return;
      } else if (flags.output === 'yaml') {
        this.log(ux.colorize('gray', new Document(diagnostics).toString()));
        return;
      } else {
        this.log(ux.colorize('gray', formatDiagnosticsHuman(diagnostics)));
      }
    } catch (error) {
      this.styledError({ message: 'Failed to fetch instance diagnostics', error });
    }
  }
}
