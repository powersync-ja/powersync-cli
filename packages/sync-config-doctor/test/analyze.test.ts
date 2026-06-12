import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { analyze } from '../src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = (name: string): string => resolve(HERE, '..', 'fixtures', name);

function findingIds(findings: { rule: string }[]): string[] {
  return findings.map((f) => f.rule).sort();
}

describe('analyzer', () => {
  it('flags nothing on a clean stream', async () => {
    const r = await analyze(FIX('clean.yaml'));
    expect(r.findings).toEqual([]);
    expect(r.exit).toBe(0);
    expect(r.budget.exceeded).toBe(false);
  });

  it('detects subquery explosion', async () => {
    const r = await analyze(FIX('subquery-explosion.yaml'));
    expect(findingIds(r.findings)).toContain('subquery-explosion');
    expect(r.exit).toBeGreaterThan(0);
  });

  it('detects cartesian filters', async () => {
    const r = await analyze(FIX('cartesian.yaml'));
    expect(findingIds(r.findings)).toContain('cartesian-filters');
  });

  it('detects jwt array parameter', async () => {
    const r = await analyze(FIX('jwt-array.yaml'));
    expect(findingIds(r.findings)).toContain('jwt-array-parameter');
  });

  it('detects many-to-many join', async () => {
    const r = await analyze(FIX('many-to-many.yaml'));
    expect(findingIds(r.findings)).toContain('many-to-many-join');
  });

  it('detects unbounded membership', async () => {
    const r = await analyze(FIX('unbounded.yaml'));
    expect(findingIds(r.findings)).toContain('unbounded-membership');
  });

  it('detects mutable log table mixing', async () => {
    const r = await analyze(FIX('log-mix.yaml'));
    expect(findingIds(r.findings)).toContain('mutable-log-table');
  });

  it('detects legacy bucket_definitions', async () => {
    const r = await analyze(FIX('legacy.yaml'));
    expect(findingIds(r.findings)).toContain('legacy-bucket-definitions');
    expect(r.format).toBe('bucket_definitions');
  });

  it('classifies legacy json_each(request.jwt() -> ...) as an array expansion', async () => {
    const r = await analyze(FIX('legacy-jwt-array.yaml'), { arrayCardinality: 50 });
    const stream = r.budget.perStream.find((s) => s.stream === 'node_collections');
    expect(stream?.buckets).toBe(50);
    expect(stream?.reasons.some((reason) => reason.includes('expand'))).toBe(true);
    expect(findingIds(r.findings)).toContain('jwt-array-parameter');
  });

  it('classifies legacy SELECT request.user_id() as a direct scalar bucket', async () => {
    const r = await analyze(FIX('legacy-user-id.yaml'));
    const stream = r.budget.perStream.find((s) => s.stream === 'instrument_profile_lists');
    expect(stream?.buckets).toBe(1);
    expect(stream?.reasons.some((reason) => reason.includes('direct'))).toBe(true);
    expect(findingIds(r.findings)).not.toContain('unbounded-membership');
  });

  it('detects hierarchical CTEs', async () => {
    const r = await analyze(FIX('hierarchical.yaml'));
    expect(findingIds(r.findings)).toContain('hierarchical-cte');
  });

  it('respects --skip-rule', async () => {
    const r = await analyze(FIX('unbounded.yaml'), { skip: ['unbounded-membership'] });
    expect(findingIds(r.findings)).not.toContain('unbounded-membership');
  });

  it('respects --rule (only)', async () => {
    const r = await analyze(FIX('cartesian.yaml'), { only: ['cartesian-filters'] });
    for (const f of r.findings) {
      expect(f.rule).toBe('cartesian-filters');
    }
  });

  it('uses array param sizes from --params for budget', async () => {
    const r = await analyze(FIX('jwt-array.yaml'), {
      params: { roles: ['a', 'b', 'c', 'd', 'e'] }
    });
    const stream = r.budget.perStream.find((s) => s.stream === 'by_role');
    expect(stream?.buckets).toBe(5);
  });

  it('marks exit=2 when budget is exceeded', async () => {
    const r = await analyze(FIX('subquery-explosion.yaml'), { maxBuckets: 1 });
    expect(r.budget.exceeded).toBe(true);
    expect(r.exit).toBe(2);
  });
});
