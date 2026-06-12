import type { Rule, Finding } from './Rule.js';
import type { FilterShape } from '../model/normalized.js';

const DOCS = 'https://docs.powersync.com/usage/sync-streams/anti-patterns#jwt-array-parameter';

function collectExpand(filter: FilterShape, out: FilterShape[] = []): FilterShape[] {
  if (filter.kind === 'expand') out.push(filter);
  else if (filter.kind === 'composite') for (const p of filter.parts) collectExpand(p, out);
  return out;
}

export const jwtArrayParameter: Rule = {
  id: 'jwt-array-parameter',
  defaultSeverity: 'info',
  check(stream, ctx) {
    const findings: Finding[] = [];
    for (const pq of stream.parameterQueries) {
      const expands = collectExpand(pq.filter);
      for (const e of expands) {
        if (e.kind !== 'expand') continue;
        findings.push({
          rule: 'jwt-array-parameter',
          severity: 'info',
          stream: stream.name,
          query: pq.sql,
          message: `\`${e.param.kind}(${e.param.argument ? `'${e.param.argument}'` : ''})\` expands into one bucket per element (~${ctx.assumptions.arrayCardinality} assumed).`,
          detail: 'Array-valued parameters from JWT/subscription claims expand into one bucket key per element. Large arrays can dominate the bucket budget.',
          suggestion: 'Cap the array size at issuance, or move the membership decision server-side so each user gets a single scalar parameter.',
          estimatedBucketImpact: 'linear-jwt-array',
          docsUrl: DOCS
        });
      }
    }
    return findings;
  }
};
