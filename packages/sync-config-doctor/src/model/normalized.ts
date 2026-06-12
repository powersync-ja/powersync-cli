export type ParameterKind =
  | 'auth.user_id'
  | 'auth.parameter'
  | 'subscription.parameter'
  | 'request.user_id'
  | 'request.parameters'
  | 'unknown';

export interface ParameterRef {
  kind: ParameterKind;
  raw: string;
  argument?: string;
}

export type FilterShape =
  | { kind: 'direct'; column: string; param: ParameterRef }
  | { kind: 'expand'; column: string; param: ParameterRef }
  | { kind: 'subquery'; column: string; subqueryTables: string[]; subquerySql: string }
  | { kind: 'cte'; cte: string; column: string }
  | { kind: 'composite'; parts: FilterShape[] }
  | { kind: 'global' }
  | { kind: 'unknown'; raw: string };

export interface CteRef {
  name: string;
  sql: string;
  referencesAuth: boolean;
  joinsTables: string[];
  /** Every table named in FROM or JOIN, in declaration order. */
  tablesReferenced: string[];
}

export interface DataQueryShape {
  sql: string;
  primaryTable: { schema?: string; name: string } | null;
  joins: { table: string; kind: 'inner' | 'left' | 'right' | 'full' | 'cross' }[];
  hasDirectAuthFilter: boolean;
}

export interface ParameterQueryShape {
  sql: string;
  bucketParameters: string[];
  filter: FilterShape;
}

export interface NormalizedStream {
  name: string;
  kind: 'stream' | 'bucket_definition';
  autoSubscribe: boolean;
  priority?: number;
  parameterQueries: ParameterQueryShape[];
  dataQueries: DataQueryShape[];
  ctes: CteRef[];
  acceptsDangerousQueries: boolean;
  global: boolean;
  /** Source tables resolved by the official parser (includes subquery/CTE tables). Empty if the parser rejected the config. */
  officialSourceTables: string[];
  /** Bucket parameter count from the official parser (names are opaque for compiled streams). */
  officialBucketParamCount: number;
}

export interface YamlIssue {
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

export interface NormalizedConfig {
  source: 'streams' | 'bucket_definitions' | 'mixed' | 'empty';
  edition?: number | 'legacy';
  yamlErrors: YamlIssue[];
  streams: NormalizedStream[];
  rawYaml: string;
  /** Every source table the official parser resolved across all streams. */
  allSourceTables: string[];
}
