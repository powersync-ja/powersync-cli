import type { Report } from './types.js';

export function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}
