import type { FilterShape, NormalizedConfig, NormalizedStream } from '../model/normalized.js';
import type { TableStats } from '../db/types.js';

export interface EstimateAssumptions {
  defaultCardinality: number;
  arrayCardinality: number;
  /** Per-table stats from the --db probe (rows/bytes/avgRowSize). Keyed by lowercase table name. */
  tableStats?: Record<string, TableStats>;
  /** Active user-base size, from probe discovery or --users. */
  userCount?: number;
  /** Per-array-parameter sizes (from --params). Keyed by argument name. */
  arraySizes?: Record<string, number>;
}

export interface StreamEstimate {
  stream: string;
  buckets: number;
  reasons: string[];
  global: boolean;
}

export interface BudgetReport {
  perStream: StreamEstimate[];
  total: number;
  budget: number;
  exceeded: boolean;
  /** True when total ≥ 80% of budget — used to emit a warning before full exhaustion. */
  threshold: boolean;
}

function tableSize(table: string, a: EstimateAssumptions): number {
  // Phase B carries probe stats but the per-user fan-out math (Phase C) doesn't consume total
  // row counts yet — total rows != per-user membership count. Fall back to the static assumption.
  return a.defaultCardinality;
}

function arraySize(arg: string | undefined, a: EstimateAssumptions): number {
  if (arg && a.arraySizes?.[arg] != null) return a.arraySizes[arg]!;
  return a.arrayCardinality;
}

function estimateFilter(filter: FilterShape, a: EstimateAssumptions): { n: number; reason: string } {
  switch (filter.kind) {
    case 'direct':
      return { n: 1, reason: `direct ${filter.param.kind} on ${filter.column}` };
    case 'expand': {
      const n = arraySize(filter.param.argument, a);
      return { n, reason: `expand ${filter.param.kind}('${filter.param.argument ?? ''}') ≈ ${n}` };
    }
    case 'subquery': {
      const tail = filter.subqueryTables[filter.subqueryTables.length - 1] ?? '';
      const n = tail ? tableSize(tail, a) : a.defaultCardinality;
      return { n, reason: `subquery on ${tail || '<unknown>'} ≈ ${n}` };
    }
    case 'cte':
      return { n: a.defaultCardinality, reason: `cte ${filter.cte} ≈ ${a.defaultCardinality}` };
    case 'composite': {
      let n = 1;
      const reasons: string[] = [];
      for (const p of filter.parts) {
        const r = estimateFilter(p, a);
        n *= Math.max(r.n, 1);
        reasons.push(r.reason);
      }
      return { n, reason: reasons.join(' × ') };
    }
    case 'global':
      return { n: 1, reason: 'global (no parameters)' };
    case 'unknown':
      return { n: a.defaultCardinality, reason: 'unrecognized filter shape — assumed default' };
  }
}

export function estimateStream(stream: NormalizedStream, a: EstimateAssumptions): StreamEstimate {
  if (stream.global || stream.parameterQueries.length === 0) {
    return { stream: stream.name, buckets: 1, reasons: ['global stream'], global: true };
  }
  let total = 0;
  const reasons: string[] = [];
  for (const pq of stream.parameterQueries) {
    const r = estimateFilter(pq.filter, a);
    total += Math.max(r.n, 1);
    reasons.push(r.reason);
  }
  return { stream: stream.name, buckets: total, reasons, global: false };
}

export function estimateBudget(
  config: NormalizedConfig,
  a: EstimateAssumptions,
  budget: number
): BudgetReport {
  const perStream = config.streams.map((s) => estimateStream(s, a));
  const total = perStream.reduce((n, s) => n + s.buckets, 0);
  return {
    perStream,
    total,
    budget,
    exceeded: total > budget,
    threshold: total >= Math.floor(budget * 0.8)
  };
}
