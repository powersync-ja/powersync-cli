import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { analyze, loadJwtPayload, parseJwtPayload } from '../src/index.js';

const FIX = (name: string): string => resolve(__dirname, '..', 'fixtures', name);

describe('jwt payload', () => {
  it('parses inline JSON', async () => {
    const claims = await loadJwtPayload('{"sub":"u1","roles":["a","b","c"]}');
    expect(claims.sub).toBe('u1');
  });

  it('loads from a file path', async () => {
    const claims = await loadJwtPayload(FIX('sample-jwt.json'));
    expect(claims.sub).toBe('00000000-0000-0000-0000-000000000001');
  });

  it('extracts user id and array sizes from top-level + nested parameters', () => {
    const parsed = parseJwtPayload({
      sub: 'u1',
      roles: ['a', 'b', 'c'],
      parameters: { projects: ['x', 'y'] }
    });
    expect(parsed.userId).toBe('u1');
    expect(parsed.arraySizes).toEqual({ roles: 3, projects: 2 });
  });

  it('falls back to user_id claim when sub is absent', () => {
    const parsed = parseJwtPayload({ user_id: 'u2', tags: ['p'] });
    expect(parsed.userId).toBe('u2');
  });

  it('feeds JWT array sizes into bucket estimate', async () => {
    const claims = await loadJwtPayload(FIX('sample-jwt.json'));
    const r = await analyze(FIX('jwt-array.yaml'), { jwt: claims });
    const stream = r.budget.perStream.find((s) => s.stream === 'by_role');
    expect(stream?.buckets).toBe(3);
  });

  it('explicit --params overrides JWT-derived sizes', async () => {
    const claims = await loadJwtPayload(FIX('sample-jwt.json'));
    const r = await analyze(FIX('jwt-array.yaml'), {
      jwt: claims,
      params: { roles: ['only-one'] }
    });
    const stream = r.budget.perStream.find((s) => s.stream === 'by_role');
    expect(stream?.buckets).toBe(1);
  });
});
