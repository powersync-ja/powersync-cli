import type { NormalizedConfig, NormalizedStream } from '../model/normalized.js';

export type Severity = 'info' | 'warning' | 'error';

export type BucketImpact =
  | 'constant'
  | 'linear-n'
  | 'linear-jwt-array'
  | 'multiplicative';

export interface Finding {
  rule: string;
  severity: Severity;
  stream: string;
  query?: string;
  message: string;
  detail: string;
  suggestion: string;
  estimatedBucketImpact?: BucketImpact;
  docsUrl?: string;
}

export interface RuleContext {
  config: NormalizedConfig;
  assumptions: { defaultCardinality: number; arrayCardinality: number };
}

export interface Rule {
  id: string;
  defaultSeverity: Severity;
  check(stream: NormalizedStream, ctx: RuleContext): Finding[];
}
