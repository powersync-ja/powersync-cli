import { parseFirst } from 'pgsql-ast-parser';
import type { CteRef, DataQueryShape, FilterShape, ParameterRef } from '../model/normalized.js';

const PARAM_PATTERNS: Array<{ kind: ParameterRef['kind']; re: RegExp }> = [
  { kind: 'auth.user_id', re: /\bauth\s*\.\s*user_id\s*\(\s*\)/gi },
  { kind: 'request.user_id', re: /\brequest\s*\.\s*user_id\s*\(\s*\)/gi },
  { kind: 'auth.parameter', re: /\bauth\s*\.\s*parameter\s*\(\s*['"]([^'"]+)['"]\s*\)/gi },
  { kind: 'subscription.parameter', re: /\bsubscription\s*\.\s*parameter\s*\(\s*['"]([^'"]+)['"]\s*\)/gi },
  { kind: 'request.parameters', re: /\brequest\s*\.\s*parameters\s*\(\s*\)\s*->>?\s*['"]([^'"]+)['"]/gi }
];

export function findParameters(sql: string): ParameterRef[] {
  const refs: ParameterRef[] = [];
  for (const { kind, re } of PARAM_PATTERNS) {
    const pattern = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(sql)) !== null) {
      const ref: ParameterRef = { kind, raw: m[0] };
      if (m[1]) ref.argument = m[1];
      refs.push(ref);
    }
  }
  return refs;
}

export function hasDirectAuthFilter(sql: string): boolean {
  return /=\s*(auth|request)\s*\.\s*user_id\s*\(\s*\)/i.test(sql) ||
    /(auth|request)\s*\.\s*user_id\s*\(\s*\)\s*=/i.test(sql);
}

const JUNCTION_NAME_PATTERNS = [
  /^[a-z]+s_[a-z]+s$/i,
  /^[a-z]+_(memberships?|assignments?|tags?|labels?|links?|roles?)$/i,
  /_(memberships?|assignments?|map|join|junction)$/i
];

export function looksLikeJunctionTable(name: string): boolean {
  return JUNCTION_NAME_PATTERNS.some((p) => p.test(name));
}

const LOG_TABLE_PATTERNS = [
  /^events?$/i,
  /^audit(_|$)/i,
  /^activity(_|$)/i,
  /^history$/i,
  /(^|_)log(s?)$/i,
  /(^|_)log_/i
];

export function looksLikeLogTable(name: string): boolean {
  return LOG_TABLE_PATTERNS.some((p) => p.test(name));
}

/**
 * Parse a SELECT statement and extract its primary table + joins + direct-auth check.
 * Falls back gracefully if the parser rejects PowerSync-specific SQL extensions.
 */
export function inspectDataQuery(sql: string): DataQueryShape {
  const shape: DataQueryShape = {
    sql,
    primaryTable: null,
    joins: [],
    hasDirectAuthFilter: hasDirectAuthFilter(sql)
  };
  let ast: ReturnType<typeof parseFirst> | null = null;
  try {
    ast = parseFirst(sql);
  } catch {
    return shape;
  }
  if (!ast || ast.type !== 'select') return shape;

  const from = ast.from;
  if (!from || from.length === 0) return shape;
  const first = from[0];
  if (first && first.type === 'table') {
    shape.primaryTable = { name: first.name.name, schema: first.name.schema };
  }
  for (const f of from.slice(1)) {
    if (f.type === 'table' && f.join) {
      const kind = (f.join.type ?? 'inner').toLowerCase().replace(/\s.*$/, '');
      shape.joins.push({
        table: f.name.name,
        kind: (['inner', 'left', 'right', 'full', 'cross'].includes(kind) ? kind : 'inner') as DataQueryShape['joins'][number]['kind']
      });
    }
  }
  return shape;
}

/**
 * Build a coarse FilterShape from a parameter query SQL string.
 * We do best-effort syntactic detection; the rule layer interprets the result.
 */
export function inspectParameterQuery(sql: string, ctes: CteRef[]): FilterShape {
  const upper = sql.toUpperCase();

  const parts: FilterShape[] = [];

  // Subquery: `... IN (SELECT ...)` or `EXISTS (SELECT ...)`
  const subqueryMatches = sql.matchAll(/\b(\w+)\s+IN\s*\(\s*SELECT\b([\s\S]*?)\)/gi);
  for (const m of subqueryMatches) {
    const column = m[1] ?? '';
    const inner = `SELECT ${m[2]}`;
    const tables = extractTableNamesFromSelect(inner);
    parts.push({ kind: 'subquery', column, subqueryTables: tables, subquerySql: inner });
  }

  // Expand: `column IN auth.parameter('foo')` or `IN subscription.parameter(...)`
  const expandMatches = sql.matchAll(/\b(\w+)\s+IN\s+(auth|subscription|request)\s*\.\s*parameter\s*\(\s*['"]([^'"]+)['"]\s*\)/gi);
  for (const m of expandMatches) {
    const column = m[1] ?? '';
    const kindWord = m[2]?.toLowerCase() ?? 'auth';
    const kind: ParameterRef['kind'] =
      kindWord === 'subscription' ? 'subscription.parameter' :
      kindWord === 'request' ? 'request.parameters' : 'auth.parameter';
    parts.push({ kind: 'expand', column, param: { kind, raw: m[0], argument: m[3] } });
  }

  // CTE reference: `column IN (SELECT col FROM <cte_name>)` where cte_name matches a known CTE
  for (const cte of ctes) {
    const ctePattern = new RegExp(`\\b(\\w+)\\s+IN\\s*\\(\\s*SELECT\\b[\\s\\S]*?FROM\\s+${escapeReg(cte.name)}\\b`, 'gi');
    const matches = sql.matchAll(ctePattern);
    for (const m of matches) {
      parts.push({ kind: 'cte', cte: cte.name, column: m[1] ?? '' });
    }
  }

  // Direct equality: `col = auth.user_id()` or `col = subscription.parameter('foo')`
  const directScalarMatches = sql.matchAll(/\b(\w+)\s*=\s*(auth|request|subscription)\s*\.\s*(user_id\s*\(\s*\)|parameter\s*\(\s*['"]([^'"]+)['"]\s*\))/gi);
  for (const m of directScalarMatches) {
    const column = m[1] ?? '';
    const scope = (m[2] ?? '').toLowerCase();
    const isUserId = !m[4];
    let kind: ParameterRef['kind'] = 'unknown';
    if (isUserId) {
      kind = scope === 'request' ? 'request.user_id' : 'auth.user_id';
    } else if (scope === 'subscription') {
      kind = 'subscription.parameter';
    } else if (scope === 'request') {
      kind = 'request.parameters';
    } else {
      kind = 'auth.parameter';
    }
    const ref: ParameterRef = { kind, raw: m[0] };
    if (m[4]) ref.argument = m[4];
    parts.push({ kind: 'direct', column, param: ref });
  }

  // Legacy `bucket_definitions.parameters` queries don't use WHERE — they project
  // bucket parameter values directly from FROM/SELECT. Recognise the two canonical
  // shapes so they don't collapse to `global`:
  //   FROM json_each(request.jwt() -> 'claim')      → array expand
  //   SELECT request.user_id() AS user_id           → scalar direct
  //   SELECT request.jwt() ->> 'claim' AS x          → scalar direct
  const jwtArrayInFrom = sql.matchAll(
    /json_each\s*\(\s*request\s*\.\s*jwt\s*\(\s*\)\s*->>?\s*['"]([^'"]+)['"]\s*\)/gi
  );
  const bucketParams = deriveBucketParameters(sql);
  let bucketParamIdx = 0;
  for (const m of jwtArrayInFrom) {
    const column = bucketParams[bucketParamIdx++] ?? '';
    parts.push({
      kind: 'expand',
      column,
      param: { kind: 'auth.parameter', raw: m[0], argument: m[1]! }
    });
  }

  // Scalar bucket parameters projected from the SELECT clause (no WHERE).
  if (!upper.includes('WHERE')) {
    const projection = sql.match(/SELECT\b([\s\S]*?)\bFROM\b/i)?.[1] ??
      sql.replace(/^[\s\S]*?\bSELECT\b/i, '');
    for (const expr of splitTopLevel(projection, ',')) {
      // Skip projections that feed the array expansion (already counted above).
      if (/\bjson_each\s*\./i.test(expr)) continue;

      const alias = projectionAlias(expr);
      if (!alias) continue;

      const scalar = matchScalarParameter(expr);
      if (scalar) parts.push({ kind: 'direct', column: alias, param: scalar });
    }
  }

  if (parts.length === 0) {
    // No recognised parameter source: classify as global only if the SQL truly
    // has no auth-shaped references. Otherwise it's an unrecognised shape that
    // the estimator should treat conservatively.
    const looksParameterized =
      /\b(auth|request|subscription)\s*\./i.test(sql) || upper.includes('WHERE');
    if (!looksParameterized) return { kind: 'global' };
    return { kind: 'unknown', raw: sql };
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  return { kind: 'composite', parts };
}

function projectionAlias(expr: string): string {
  const aliasMatch = expr.match(/\bAS\s+["']?([a-zA-Z_][\w]*)["']?\s*$/i);
  if (aliasMatch && aliasMatch[1]) return aliasMatch[1];
  const trimmed = expr.trim();
  const tail = trimmed.split(/\s+/).pop() ?? trimmed;
  const ident = tail.split('.').pop() ?? tail;
  return ident.replace(/[^a-zA-Z0-9_]/g, '');
}

function matchScalarParameter(expr: string): ParameterRef | null {
  const userIdMatch = expr.match(/\b(auth|request)\s*\.\s*user_id\s*\(\s*\)/i);
  if (userIdMatch) {
    const scope = (userIdMatch[1] ?? '').toLowerCase();
    return {
      kind: scope === 'request' ? 'request.user_id' : 'auth.user_id',
      raw: userIdMatch[0]
    };
  }
  const jwtScalar = expr.match(/request\s*\.\s*jwt\s*\(\s*\)\s*->>?\s*['"]([^'"]+)['"]/i);
  if (jwtScalar) {
    return { kind: 'auth.parameter', raw: jwtScalar[0], argument: jwtScalar[1]! };
  }
  const authParam = expr.match(/\bauth\s*\.\s*parameter\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (authParam) {
    return { kind: 'auth.parameter', raw: authParam[0], argument: authParam[1]! };
  }
  const subParam = expr.match(/\bsubscription\s*\.\s*parameter\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (subParam) {
    return { kind: 'subscription.parameter', raw: subParam[0], argument: subParam[1]! };
  }
  const reqParams = expr.match(/\brequest\s*\.\s*parameters\s*\(\s*\)\s*->>?\s*['"]([^'"]+)['"]/i);
  if (reqParams) {
    return { kind: 'request.parameters', raw: reqParams[0], argument: reqParams[1]! };
  }
  return null;
}

function extractTableNamesFromSelect(sql: string): string[] {
  const result: string[] = [];
  const re = /\bFROM\s+([a-zA-Z_][\w.]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const ident = m[1];
    if (!ident) continue;
    const parts = ident.split('.');
    result.push(parts[parts.length - 1] ?? ident);
  }
  // JOINs as well
  const re2 = /\bJOIN\s+([a-zA-Z_][\w.]*)/gi;
  while ((m = re2.exec(sql)) !== null) {
    const ident = m[1];
    if (!ident) continue;
    const parts = ident.split('.');
    result.push(parts[parts.length - 1] ?? ident);
  }
  return result;
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function deriveBucketParameters(sql: string): string[] {
  // PowerSync uses `SELECT col AS bucket_param` (or just `col`) — pull the output names.
  const params: string[] = [];
  const match = sql.match(/SELECT\b([\s\S]*?)\bFROM\b/i);
  if (!match) return params;
  const projection = match[1] ?? '';
  for (const expr of splitTopLevel(projection, ',')) {
    const asMatch = expr.match(/\bAS\s+([a-zA-Z_][\w]*)\s*$/i);
    if (asMatch && asMatch[1]) {
      params.push(asMatch[1]);
      continue;
    }
    const trimmed = expr.trim();
    const tail = trimmed.split(/\s+/).pop() ?? trimmed;
    const ident = tail.split('.').pop() ?? tail;
    const cleaned = ident.replace(/[^a-zA-Z0-9_]/g, '');
    if (cleaned) params.push(cleaned);
  }
  return params;
}

function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current);
  return out;
}
