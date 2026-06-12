import type { Rule } from './Rule.js';
import { subqueryExplosion } from './subqueryExplosion.js';
import { cartesianFilters } from './cartesianFilters.js';
import { hierarchicalCte } from './hierarchicalCte.js';
import { manyToManyJoin } from './manyToManyJoin.js';
import { jwtArrayParameter } from './jwtArrayParameter.js';
import { unboundedMembership } from './unboundedMembership.js';
import { mutableLogTable } from './mutableLogTable.js';
import { legacyBucketDefinitions } from './legacyBucketDefinitions.js';

export const ALL_RULES: Rule[] = [
  subqueryExplosion,
  cartesianFilters,
  hierarchicalCte,
  manyToManyJoin,
  jwtArrayParameter,
  unboundedMembership,
  mutableLogTable,
  legacyBucketDefinitions
];

export function selectRules(only: string[] = [], skip: string[] = []): Rule[] {
  let rules = ALL_RULES;
  if (only.length > 0) {
    const allow = new Set(only);
    rules = rules.filter((r) => allow.has(r.id));
  }
  if (skip.length > 0) {
    const block = new Set(skip);
    rules = rules.filter((r) => !block.has(r.id));
  }
  return rules;
}

export type { Rule, Finding, Severity, BucketImpact, RuleContext } from './Rule.js';
