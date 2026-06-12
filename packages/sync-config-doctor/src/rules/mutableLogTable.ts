import { looksLikeLogTable } from '../util/sqlInspect.js';
import type { Rule, Finding } from './Rule.js';

const DOCS = 'https://docs.powersync.com/usage/sync-streams/anti-patterns#mutable-log-table';

export const mutableLogTable: Rule = {
  id: 'mutable-log-table',
  defaultSeverity: 'info',
  check(stream) {
    const findings: Finding[] = [];
    const tables = new Set<string>();
    for (const dq of stream.dataQueries) {
      if (dq.primaryTable) tables.add(dq.primaryTable.name);
      for (const j of dq.joins) tables.add(j.table);
    }
    const logs = [...tables].filter(looksLikeLogTable);
    const stable = [...tables].filter((t) => !looksLikeLogTable(t));
    if (logs.length > 0 && stable.length > 0) {
      findings.push({
        rule: 'mutable-log-table',
        severity: 'info',
        stream: stream.name,
        message: `Stream mixes log-shaped table${logs.length > 1 ? 's' : ''} (\`${logs.join('`, `')}\`) with stable tables (\`${stable.join('`, `')}\`).`,
        detail: 'Log tables grow continuously while stable tables churn slowly; mixing them in one stream causes compactor fragmentation as the log\'s row count outpaces compactions of the stable rows.',
        suggestion: 'Put log/event tables into a dedicated stream with a time window, and leave the stable tables in their own stream.',
        docsUrl: DOCS
      });
    }
    return findings;
  }
};
