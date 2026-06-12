import { parse as parseYaml } from 'yaml';
import type {
  CteRef,
  NormalizedConfig,
  NormalizedStream,
  ParameterQueryShape,
  YamlIssue
} from './normalized.js';
import {
  deriveBucketParameters,
  inspectDataQuery,
  inspectParameterQuery,
  hasDirectAuthFilter
} from '../util/sqlInspect.js';

type Json = Record<string, unknown>;

export interface OfficialStructureInput {
  sourceTablesByStream: Map<string, string[]>;
  bucketParamCountByStream: Map<string, number>;
  allSourceTables: string[];
}

export interface NormalizeOptions {
  yamlIssues?: YamlIssue[];
  structure?: OfficialStructureInput;
}

export function normalize(yaml: string, opts: NormalizeOptions = {}): NormalizedConfig {
  const yamlIssues = [...(opts.yamlIssues ?? [])];
  const structure = opts.structure;
  let raw: Json | null = null;
  try {
    const parsed = parseYaml(yaml);
    if (parsed && typeof parsed === 'object') raw = parsed as Json;
  } catch (e) {
    yamlIssues.push({
      message: e instanceof Error ? e.message : String(e),
      severity: 'error'
    });
  }

  if (!raw) {
    return {
      source: 'empty',
      streams: [],
      yamlErrors: yamlIssues,
      rawYaml: yaml,
      allSourceTables: structure?.allSourceTables ?? []
    };
  }

  const config = raw['config'];
  const edition = config && typeof config === 'object'
    ? (config as Json)['edition']
    : undefined;

  const streams: NormalizedStream[] = [];
  const streamBlock = raw['streams'];
  const bucketBlock = raw['bucket_definitions'];

  if (streamBlock && typeof streamBlock === 'object') {
    for (const [name, body] of Object.entries(streamBlock as Json)) {
      if (!body || typeof body !== 'object') continue;
      streams.push(normalizeStream(name, body as Json));
    }
  }
  if (bucketBlock && typeof bucketBlock === 'object') {
    for (const [name, body] of Object.entries(bucketBlock as Json)) {
      if (!body || typeof body !== 'object') continue;
      streams.push(normalizeBucketDefinition(name, body as Json));
    }
  }

  if (structure) {
    for (const stream of streams) {
      stream.officialSourceTables = structure.sourceTablesByStream.get(stream.name) ?? [];
      stream.officialBucketParamCount = structure.bucketParamCountByStream.get(stream.name) ?? 0;
    }
  }

  let source: NormalizedConfig['source'] = 'empty';
  if (streamBlock && bucketBlock) source = 'mixed';
  else if (streamBlock) source = 'streams';
  else if (bucketBlock) source = 'bucket_definitions';

  const result: NormalizedConfig = {
    source,
    yamlErrors: yamlIssues,
    streams,
    rawYaml: yaml,
    allSourceTables: structure?.allSourceTables ?? []
  };
  if (typeof edition === 'number') {
    result.edition = edition;
  } else if (source === 'bucket_definitions') {
    result.edition = 'legacy';
  }
  return result;
}

function normalizeStream(name: string, body: Json): NormalizedStream {
  const autoSubscribe = body['auto_subscribe'] === true;
  const priority = typeof body['priority'] === 'number' ? (body['priority'] as number) : undefined;
  const acceptsDangerousQueries = body['accept_potentially_dangerous_queries'] === true;

  const ctes = collectCtes(body['with']);

  const queries: string[] = [];
  if (typeof body['query'] === 'string') queries.push(body['query'] as string);
  if (Array.isArray(body['queries'])) {
    for (const q of body['queries']) {
      if (typeof q === 'string') queries.push(q);
    }
  }

  const dataQueries = queries.map((sql) => inspectDataQuery(sql));

  // Streams don't have a separate `parameters:` block; the bucket key comes from CTE filters.
  // We surface CTEs that involve auth / subscription params as synthesized parameter queries
  // so the rule layer can flag them uniformly.
  const parameterQueries: ParameterQueryShape[] = ctes
    .filter((c) => c.referencesAuth)
    .map((c) => ({
      sql: c.sql,
      bucketParameters: deriveBucketParameters(c.sql),
      filter: inspectParameterQuery(c.sql, ctes)
    }));

  const stream: NormalizedStream = {
    name,
    kind: 'stream',
    autoSubscribe,
    parameterQueries,
    dataQueries,
    ctes,
    acceptsDangerousQueries,
    global: parameterQueries.length === 0,
    officialSourceTables: [],
    officialBucketParamCount: 0
  };
  if (priority !== undefined) stream.priority = priority;
  return stream;
}

function normalizeBucketDefinition(name: string, body: Json): NormalizedStream {
  const priority = typeof body['priority'] === 'number' ? (body['priority'] as number) : undefined;
  const paramsRaw = body['parameters'];
  const paramQueries: string[] = [];
  if (typeof paramsRaw === 'string') paramQueries.push(paramsRaw);
  if (Array.isArray(paramsRaw)) {
    for (const q of paramsRaw) if (typeof q === 'string') paramQueries.push(q);
  }

  const dataRaw = body['data'];
  const dataQueries: string[] = [];
  if (Array.isArray(dataRaw)) {
    for (const q of dataRaw) if (typeof q === 'string') dataQueries.push(q);
  } else if (typeof dataRaw === 'string') {
    dataQueries.push(dataRaw);
  }

  const ctes: CteRef[] = [];
  const parameterQueries: ParameterQueryShape[] = paramQueries.map((sql) => ({
    sql,
    bucketParameters: deriveBucketParameters(sql),
    filter: inspectParameterQuery(sql, ctes)
  }));

  const result: NormalizedStream = {
    name,
    kind: 'bucket_definition',
    autoSubscribe: true,
    parameterQueries,
    dataQueries: dataQueries.map((sql) => inspectDataQuery(sql)),
    ctes,
    acceptsDangerousQueries: false,
    global: parameterQueries.length === 0,
    officialSourceTables: [],
    officialBucketParamCount: 0
  };
  if (priority !== undefined) result.priority = priority;
  return result;
}

function collectCtes(withBlock: unknown): CteRef[] {
  if (!withBlock || typeof withBlock !== 'object') return [];
  const result: CteRef[] = [];
  for (const [name, sqlRaw] of Object.entries(withBlock as Json)) {
    if (typeof sqlRaw !== 'string') continue;
    const sql = sqlRaw;
    const referencesAuth =
      /\b(auth|request)\s*\.\s*(user_id|parameter|parameters)\s*\(/i.test(sql) ||
      /\bsubscription\s*\.\s*parameter\s*\(/i.test(sql);
    const joinsTables = (sql.match(/\bJOIN\s+([a-zA-Z_][\w.]*)/gi) ?? []).map((m) =>
      m.replace(/^JOIN\s+/i, '').split('.').pop() ?? ''
    ).filter(Boolean);
    const fromTables = (sql.match(/\bFROM\s+([a-zA-Z_][\w.]*)/gi) ?? []).map((m) =>
      m.replace(/^FROM\s+/i, '').split('.').pop() ?? ''
    ).filter(Boolean);
    result.push({ name, sql, referencesAuth, joinsTables, tablesReferenced: [...fromTables, ...joinsTables] });
  }
  return result;
}

export function hasGlobalAuthFilter(sql: string): boolean {
  return hasDirectAuthFilter(sql);
}
