import { routes } from '@powersync/management-types';

export type DiagnosticsResponse = routes.InstanceDiagnosticsResponse;
export type SyncRulesSection = NonNullable<DiagnosticsResponse['active_sync_rules']>;

const INDENT = '  ';
const BULLET = '•';

function pad(level: number): string {
  return INDENT.repeat(level);
}

/** Format a date value as "ISO (local)" for human output. Returns raw value if not parseable. */
function formatDate(value: null | number | string | undefined): string {
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
    lines.push(
      `${p}${BULLET} ${conn.id}`,
      `${p}  Postgres URI: ${conn.postgres_uri ?? '—'}`,
      `${p}  Status: ${status}`
    );
    if (conn.errors?.length) {
      lines.push(`${p}  Errors:`, formatErrors(conn.errors, indentLevel + 2));
    }

    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

function formatSyncRulesSection(section: SyncRulesSection, indentLevel: number): string {
  const p = pad(indentLevel);
  const lines: string[] = [];

  if (section.errors?.length) {
    lines.push(`${p}Errors:`, formatErrors(section.errors, indentLevel + 1), '');
  }

  if (section.connections?.length) {
    lines.push(`${p}Connections:`);
    for (const conn of section.connections) {
      lines.push(
        `${p}  ${BULLET} ${conn.tag ?? conn.id} (slot: ${conn.slot_name ?? '—'})`,
        `${p}    Initial replication done: ${conn.initial_replication_done}`
      );
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
          lines.push(
            `${p}      - ${name} (replication_id: ${repl})`,
            `${p}        data_queries: ${table.data_queries}`,
            `${p}        parameter_queries: ${table.parameter_queries}`,
            formatErrors(table.errors, indentLevel + 3)
          );
        }
      }
    }

    lines.push('');
  }

  if (section.content != null && section.content !== '') {
    lines.push(`${p}Content:`, `${p}  ${section.content.split('\n').join(`\n${p}  `)}`);
  }

  return lines.join('\n').trimEnd() || `${p}(no data)\n`;
}

export function formatDiagnosticsHuman(diagnostics: DiagnosticsResponse): string {
  const sections: string[] = [];

  sections.push('═══ Connections ═══', formatConnectionsSection(diagnostics.connections ?? [], 0));

  if (diagnostics.active_sync_rules != null) {
    sections.push('═══ Active Sync Config ═══', formatSyncRulesSection(diagnostics.active_sync_rules, 0));
  }

  if (diagnostics.deploying_sync_rules != null) {
    sections.push('═══ Deploying Sync Config ═══', formatSyncRulesSection(diagnostics.deploying_sync_rules, 0));
  }

  return sections.join('\n').trimEnd();
}
