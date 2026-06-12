import type { Rule, Finding } from './Rule.js';
import type { FilterShape } from '../model/normalized.js';

const DOCS = 'https://docs.powersync.com/usage/sync-streams/anti-patterns#cartesian-filters';

function expandingAxes(filter: FilterShape): number {
  if (filter.kind === 'expand' || filter.kind === 'subquery' || filter.kind === 'cte') return 1;
  if (filter.kind === 'composite') return filter.parts.reduce((n, p) => n + expandingAxes(p), 0);
  return 0;
}

export const cartesianFilters: Rule = {
  id: 'cartesian-filters',
  defaultSeverity: 'warning',
  check(stream) {
    const findings: Finding[] = [];
    for (const pq of stream.parameterQueries) {
      const axes = expandingAxes(pq.filter);
      if (axes >= 2) {
        findings.push({
          rule: 'cartesian-filters',
          severity: 'warning',
          stream: stream.name,
          query: pq.sql,
          message: `Parameter query has ${axes} independent expanding filters — bucket count multiplies.`,
          detail: 'Each expanding axis (IN subquery, IN array param, CTE join) multiplies into the others. Two axes of N and M produce N×M buckets.',
          suggestion: 'Collapse the axes into a single CTE that pre-joins them, or split the stream into one per axis so they sync in parallel without multiplication.',
          estimatedBucketImpact: 'multiplicative',
          docsUrl: DOCS
        });
      }
    }
    return findings;
  }
};
