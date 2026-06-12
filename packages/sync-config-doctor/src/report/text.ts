import Table from 'cli-table3';
import pc from 'picocolors';
import type { Report } from './types.js';
import type { Finding, Severity } from '../rules/Rule.js';

export interface TextRenderOptions {
  color: boolean;
}

function paint(opts: TextRenderOptions) {
  if (opts.color) return pc;
  const noop = (s: string | number): string => String(s);
  return new Proxy({}, { get: () => noop }) as typeof pc;
}

function severityTag(s: Severity, c: ReturnType<typeof paint>): string {
  if (s === 'error') return c.red(c.bold('error'));
  if (s === 'warning') return c.yellow('warn');
  return c.cyan('info');
}

export function renderText(report: Report, opts: TextRenderOptions = { color: true }): string {
  const c = paint(opts);
  const lines: string[] = [];

  lines.push(c.bold(`sync-config-doctor`) + `  ${report.source.path}`);
  lines.push(c.dim(`format: ${report.format}` + (report.edition != null ? `  edition: ${report.edition}` : '')));
  lines.push('');

  if (report.yamlIssues.length > 0) {
    lines.push(c.bold('YAML issues'));
    for (const i of report.yamlIssues) {
      const loc = i.line != null ? c.dim(` (${i.line}:${i.column ?? 0})`) : '';
      lines.push(`  ${severityTag(i.severity, c)} ${i.message}${loc}`);
    }
    lines.push('');
  }

  lines.push(c.bold('Bucket budget'));
  const budgetTable = new Table({
    head: ['stream', 'buckets', 'why'],
    style: { head: opts.color ? ['dim'] : [], border: opts.color ? ['dim'] : [] }
  });
  for (const s of report.budget.perStream) {
    budgetTable.push([s.stream, String(s.buckets), s.reasons.join('; ')]);
  }
  budgetTable.push([
    c.bold('total'),
    c.bold(String(report.budget.total)),
    `budget ${report.budget.budget}${report.budget.exceeded ? c.red(' EXCEEDED') : report.budget.threshold ? c.yellow(' threshold') : ''}`
  ]);
  lines.push(budgetTable.toString());
  lines.push('');

  if (report.findings.length === 0) {
    lines.push(c.green('No findings.'));
  } else {
    lines.push(c.bold(`Findings (${report.findings.length})`));
    const byStream = new Map<string, Finding[]>();
    for (const f of report.findings) {
      const arr = byStream.get(f.stream) ?? [];
      arr.push(f);
      byStream.set(f.stream, arr);
    }
    for (const [stream, fs] of byStream) {
      lines.push('');
      lines.push(c.underline(stream));
      for (const f of fs) {
        lines.push(`  ${severityTag(f.severity, c)} ${c.bold(f.rule)}  ${f.message}`);
        lines.push(c.dim(`    ${f.detail}`));
        lines.push(`    ${c.green('→')} ${f.suggestion}`);
        if (f.docsUrl) lines.push(c.dim(`    ${f.docsUrl}`));
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}
