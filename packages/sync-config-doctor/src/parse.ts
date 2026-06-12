import { SqlSyncRules } from '@powersync/service-sync-rules';
import type { YamlIssue } from './model/normalized.js';

export interface OfficialStructure {
  /** stream/bucket name → source tables the official parser resolved (includes subquery tables). */
  sourceTablesByStream: Map<string, string[]>;
  /** stream/bucket name → bucket parameter count (names are opaque for compiled streams). */
  bucketParamCountByStream: Map<string, number>;
  /** Every source table referenced anywhere in the config. */
  allSourceTables: string[];
  /** True if the official parser produced at least one bucket source. */
  parsed: boolean;
}

export interface ParseResult {
  yamlIssues: YamlIssue[];
  fatal: boolean;
  structure: OfficialStructure;
}

const EDITION_3_PREFIX = 'config:\n  edition: 3\n';
const EDITION_3_PREFIX_LINES = 2;

/**
 * Modern `streams:` configs need `config.edition: 3` (COMPILED_STREAMS) to unlock CTE support;
 * without it the official parser emits fatal "CTEs not supported" / "edition 2 required" errors.
 * We inject it only when the author hasn't declared a `config:` block, so explicit edition choices win.
 */
export function prepareYaml(yaml: string): { yaml: string; injectedLines: number } {
  if (/^\s*config\s*:/m.test(yaml)) return { yaml, injectedLines: 0 };
  if (/^\s*streams\s*:/m.test(yaml)) {
    return { yaml: EDITION_3_PREFIX + yaml, injectedLines: EDITION_3_PREFIX_LINES };
  }
  return { yaml, injectedLines: 0 };
}

function offsetToLine(text: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

export function validateWithOfficialParser(yaml: string, defaultSchema: string): ParseResult {
  const { yaml: prepared, injectedLines } = prepareYaml(yaml);
  const yamlIssues: YamlIssue[] = [];
  let fatal = false;
  const sourceTablesByStream = new Map<string, string[]>();
  const bucketParamCountByStream = new Map<string, number>();
  const allSourceTables = new Set<string>();
  let parsed = false;

  try {
    const { config, errors } = SqlSyncRules.fromYaml(prepared, { defaultSchema, throwOnError: false });
    for (const err of errors) {
      const issue: YamlIssue = {
        message: err.message,
        severity: err.type === 'warning' ? 'warning' : 'error'
      };
      if (err.location?.start != null) {
        const line = offsetToLine(prepared, err.location.start) - injectedLines;
        if (line > 0) issue.line = line;
      }
      yamlIssues.push(issue);
      if (issue.severity === 'error') fatal = true;
    }

    for (const src of config.bucketSources) {
      parsed = true;
      const tables = new Set<string>();
      let paramCount = 0;
      for (const ds of src.dataSources) {
        for (const t of ds.getSourceTables()) {
          tables.add(t.name);
          allSourceTables.add(t.name);
        }
        paramCount = Math.max(paramCount, ds.bucketParameters.length);
      }
      for (const pc of src.parameterIndexLookupCreators) {
        for (const t of pc.getSourceTables()) {
          tables.add(t.name);
          allSourceTables.add(t.name);
        }
      }
      sourceTablesByStream.set(src.name, [...tables]);
      bucketParamCountByStream.set(src.name, paramCount);
    }
  } catch (e) {
    yamlIssues.push({ message: e instanceof Error ? e.message : String(e), severity: 'error' });
    fatal = true;
  }

  return {
    yamlIssues,
    fatal,
    structure: {
      sourceTablesByStream,
      bucketParamCountByStream,
      allSourceTables: [...allSourceTables],
      parsed
    }
  };
}
