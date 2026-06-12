import type { Report } from './types.js';

export function computeExit(report: Omit<Report, 'exit'>): 0 | 1 | 2 | 3 {
  if (report.yamlIssues.some((i) => i.severity === 'error')) return 2;
  if (report.budget.exceeded) return 2;
  if (report.findings.some((f) => f.severity === 'error')) return 2;
  if (report.budget.threshold) return 1;
  if (report.findings.some((f) => f.severity === 'warning')) return 1;
  return 0;
}
