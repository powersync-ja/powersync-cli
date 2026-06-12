import { looksLikeJunctionTable } from '../util/sqlInspect.js';
import type { Rule, Finding } from './Rule.js';

const DOCS = 'https://docs.powersync.com/usage/sync-streams/anti-patterns#many-to-many-join';

export const manyToManyJoin: Rule = {
  id: 'many-to-many-join',
  defaultSeverity: 'warning',
  check(stream) {
    const findings: Finding[] = [];
    for (const dq of stream.dataQueries) {
      if (!dq.primaryTable) continue;
      const allTables = [dq.primaryTable.name, ...dq.joins.map((j) => j.table)];
      const junctions = allTables.filter(looksLikeJunctionTable);
      const leaves = allTables.filter((t) => !looksLikeJunctionTable(t));
      if (junctions.length >= 1 && leaves.length >= 2 && !dq.hasDirectAuthFilter) {
        findings.push({
          rule: 'many-to-many-join',
          severity: 'warning',
          stream: stream.name,
          query: dq.sql,
          message: `Data query joins through junction table${junctions.length > 1 ? 's' : ''} \`${junctions.join('`, `')}\` — every leaf row becomes its own bucket key.`,
          detail: 'Without a direct `= auth.user_id()` filter on the leaf table, PowerSync uses the junction key to bucket, which inflates bucket count by membership cardinality.',
          suggestion: 'Add a direct user-id column to the leaf table (denormalize), or move the junction filter into a parameter query that yields one bucket per user.',
          estimatedBucketImpact: 'linear-n',
          docsUrl: DOCS
        });
      }
    }
    return findings;
  }
};
