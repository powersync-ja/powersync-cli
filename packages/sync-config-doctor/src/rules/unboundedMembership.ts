import type { Rule, Finding } from './Rule.js';

const DOCS = 'https://docs.powersync.com/usage/sync-streams/anti-patterns#unbounded-membership';

export const unboundedMembership: Rule = {
  id: 'unbounded-membership',
  defaultSeverity: 'warning',
  check(stream) {
    const findings: Finding[] = [];
    if (stream.parameterQueries.length > 0 && !stream.global) return findings;
    for (const dq of stream.dataQueries) {
      if (!dq.primaryTable) continue;
      if (dq.hasDirectAuthFilter) continue;
      if (stream.parameterQueries.length === 0) {
        findings.push({
          rule: 'unbounded-membership',
          severity: 'warning',
          stream: stream.name,
          query: dq.sql,
          message: `Data query on \`${dq.primaryTable.name}\` has no direct auth filter and the stream has no parameter query to constrain it.`,
          detail: 'Without either `WHERE col = auth.user_id()` on the leaf row or a parameter query that defines bucket keys, every row syncs to every user.',
          suggestion: 'Add a direct user-id filter on the data query, or define a parameter query that restricts rows to the subscribing user.',
          estimatedBucketImpact: 'linear-n',
          docsUrl: DOCS
        });
      }
    }
    return findings;
  }
};
