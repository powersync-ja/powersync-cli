import type { Finding } from '../rules/Rule.js';
import type { BudgetReport } from '../estimate/index.js';
import type { YamlIssue } from '../model/normalized.js';

export interface Report {
  source: { path: string; sha256: string };
  edition?: number | 'legacy';
  format: 'streams' | 'bucket_definitions' | 'mixed' | 'empty';
  yamlIssues: YamlIssue[];
  findings: Finding[];
  budget: BudgetReport;
  exit: 0 | 1 | 2 | 3;
}
