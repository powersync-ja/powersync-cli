import { looksLikeJunctionTable, looksLikeLogTable } from '../util/sqlInspect.js';
import type { Rule, Finding } from './Rule.js';

const DOCS = 'https://docs.powersync.com/usage/sync-streams/anti-patterns#subquery-explosion';

export const subqueryExplosion: Rule = {
  id: 'subquery-explosion',
  defaultSeverity: 'warning',
  check(stream, ctx) {
    const findings: Finding[] = [];
    for (const pq of stream.parameterQueries) {
      const visit = (filter: typeof pq.filter): void => {
        if (filter.kind === 'subquery') {
          const table = filter.subqueryTables[filter.subqueryTables.length - 1] ?? '';
          const isJunction = looksLikeJunctionTable(table);
          findings.push({
            rule: 'subquery-explosion',
            severity: 'warning',
            stream: stream.name,
            query: pq.sql,
            message: `Parameter query uses \`IN (SELECT …)\` against ${table || 'a subquery'} — one bucket per matching row.`,
            detail: isJunction
              ? `Membership-style table \`${table}\` will produce one bucket per row the user appears in. With ~${ctx.assumptions.defaultCardinality} memberships per user, this stream alone allocates that many buckets.`
              : `Subqueries in bucket-parameter position fan out to one bucket per returned row (~${ctx.assumptions.defaultCardinality} assumed).`,
            suggestion:
              'Move the membership lookup into a CTE under `with:` and reference its key columns from the bucket parameters, so PowerSync can de-duplicate keys.',
            estimatedBucketImpact: 'linear-n',
            docsUrl: DOCS
          });
        } else if (filter.kind === 'composite') {
          for (const p of filter.parts) visit(p);
        }
      };
      visit(pq.filter);
    }
    for (const cte of stream.ctes) {
      if (!cte.referencesAuth) continue;
      const joinsLog = cte.joinsTables.some(looksLikeLogTable);
      if (joinsLog) {
        findings.push({
          rule: 'subquery-explosion',
          severity: 'warning',
          stream: stream.name,
          query: cte.sql,
          message: `CTE \`${cte.name}\` joins through a log-shaped table — bucket count grows with event volume.`,
          detail: 'Log/event tables grow unbounded, so bucket count climbs with history rather than user fan-out.',
          suggestion: 'Filter the CTE to only currently-relevant rows (e.g. by status, recency), or split the stream so logs use a global, time-windowed query.',
          estimatedBucketImpact: 'linear-n',
          docsUrl: DOCS
        });
      }
    }
    return findings;
  }
};
