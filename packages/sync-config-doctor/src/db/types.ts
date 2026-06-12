import type { ProbeMode } from './safety.js';

export interface TableStats {
  table: string;
  /** Estimated total row count. Planner estimate by default, exact COUNT(*) under --exact. */
  rows: number;
  /** Estimated total on-disk size in bytes (incl. indexes/toast where the engine reports it). */
  bytes: number;
  /** bytes / rows, or 0 when rows is 0. */
  avgRowSize: number;
  /** True when the figures came from a real scan rather than planner statistics. */
  exact: boolean;
}

export interface ProbeResult {
  /** Lowercased table name → stats. */
  tables: Record<string, TableStats>;
  /** Active user-base size, discovered from the user table (or undefined if not found). */
  userCount?: number;
  notes: string[];
  skipped: { table: string; reason: string }[];
  mode: ProbeMode;
}

export interface ProbeOptions {
  url: string;
  schema: string;
  mode: ProbeMode;
  /** Table to count for user-base size discovery (default 'users'). */
  userTable?: string;
}

export interface ProbeBackend {
  protocols: string[];
  probe(opts: ProbeOptions, tables: string[]): Promise<ProbeResult>;
}

export function emptyResult(mode: ProbeMode): ProbeResult {
  return { tables: {}, notes: [], skipped: [], mode };
}
