import type { Rule, Finding } from './Rule.js';

const DOCS = 'https://docs.powersync.com/usage/sync-streams/anti-patterns#hierarchical-cte';

export const hierarchicalCte: Rule = {
  id: 'hierarchical-cte',
  defaultSeverity: 'warning',
  check(stream, ctx) {
    const findings: Finding[] = [];
    if (stream.ctes.length < 2) return findings;
    const authCtes = stream.ctes.filter((c) => c.referencesAuth);
    if (authCtes.length < 2) return findings;
    const tableSets = new Set(authCtes.map((c) => c.tablesReferenced.join('|')));
    if (tableSets.size > 1) {
      findings.push({
        rule: 'hierarchical-cte',
        severity: 'warning',
        stream: stream.name,
        message: `Stream has ${authCtes.length} CTEs at different hierarchy levels — each level adds a bucket fan-out axis.`,
        detail: `CTEs ${authCtes.map((c) => '`' + c.name + '`').join(', ')} touch different tables, so their cardinalities multiply (assumed ~${ctx.assumptions.defaultCardinality} per level).`,
        suggestion: 'Flatten the hierarchy by joining once at the deepest level you need, or split each level into its own stream.',
        estimatedBucketImpact: 'multiplicative',
        docsUrl: DOCS
      });
    }
    return findings;
  }
};
