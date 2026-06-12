import { loadYaml } from './load.js';
import { validateWithOfficialParser } from './parse.js';
import { normalize } from './model/normalize.js';
import { selectRules } from './rules/index.js';
import { estimateBudget, type EstimateAssumptions } from './estimate/index.js';
import { computeExit, type Report } from './report/index.js';
import { probe } from './db/index.js';
import { parseJwtPayload, type JwtClaims } from './jwt.js';
import type { Finding } from './rules/Rule.js';

export interface AnalyzeOptions {
  schema?: string;
  maxBuckets?: number;
  defaultCardinality?: number;
  arrayCardinality?: number;
  params?: Record<string, unknown>;
  jwt?: JwtClaims;
  only?: string[];
  skip?: string[];
  db?: { url: string; exact?: boolean; allowProd?: boolean; userTable?: string };
  /** Explicit user-base size; overrides probe discovery. */
  users?: number;
}

export async function analyze(file: string, opts: AnalyzeOptions = {}): Promise<Report> {
  const schema = opts.schema ?? 'public';
  const loaded = await loadYaml(file);
  const parsed = validateWithOfficialParser(loaded.contents, schema);
  const config = normalize(loaded.contents, {
    yamlIssues: parsed.yamlIssues,
    structure: parsed.structure
  });

  const assumptions: EstimateAssumptions = {
    defaultCardinality: opts.defaultCardinality ?? 100,
    arrayCardinality: opts.arrayCardinality ?? 20
  };

  const jwt = opts.jwt ? parseJwtPayload(opts.jwt) : undefined;

  const arraySizes: Record<string, number> = { ...(jwt?.arraySizes ?? {}) };
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (Array.isArray(v)) arraySizes[k] = v.length;
    }
  }
  if (Object.keys(arraySizes).length > 0) assumptions.arraySizes = arraySizes;

  if (opts.db) {
    const result = await probe(
      {
        url: opts.db.url,
        schema,
        mode: opts.db.exact ? 'exact' : 'planner-stats',
        ...(opts.db.userTable ? { userTable: opts.db.userTable } : {}),
        allowProd: opts.db.allowProd
      },
      config.allSourceTables
    );
    assumptions.tableStats = result.tables;
    if (result.userCount != null) assumptions.userCount = result.userCount;
  }
  if (opts.users != null) assumptions.userCount = opts.users;

  const rules = selectRules(opts.only, opts.skip);
  const ctx = { config, assumptions };
  const findings: Finding[] = [];
  for (const stream of config.streams) {
    for (const rule of rules) {
      for (const f of rule.check(stream, ctx)) findings.push(f);
    }
  }

  const budget = estimateBudget(config, assumptions, opts.maxBuckets ?? 1000);

  // Sanity-check our static analysis against the official parser: when the parser
  // resolved bucket parameters but our shape-detector landed on `global`, the budget
  // is a silent under-estimate. Surface that as a yaml issue so users aren't misled.
  for (const stream of config.streams) {
    if (stream.officialBucketParamCount <= 0) continue;
    const allGlobal =
      stream.parameterQueries.length === 0 ||
      stream.parameterQueries.every((pq) => pq.filter.kind === 'global');
    if (!allGlobal) continue;
    config.yamlErrors.push({
      message:
        `Stream \`${stream.name}\`: the PowerSync parser recognises ${stream.officialBucketParamCount} bucket parameter(s), ` +
        `but the doctor could not classify the parameter query — the bucket count shown is a lower bound. ` +
        `Please file a sample of the parameter query so we can extend coverage.`,
      severity: 'warning'
    });
  }

  const base: Omit<Report, 'exit'> = {
    source: { path: loaded.path, sha256: loaded.sha256 },
    format: config.source,
    yamlIssues: config.yamlErrors,
    findings,
    budget
  };
  if (config.edition !== undefined) (base as Report).edition = config.edition;
  const exit = computeExit(base);
  return { ...base, exit };
}

export type { Report } from './report/index.js';
export type { Finding } from './rules/Rule.js';
export { renderJson, renderText } from './report/index.js';
export { loadJwtPayload, parseJwtPayload } from './jwt.js';
export type { JwtClaims } from './jwt.js';
