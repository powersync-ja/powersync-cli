import type { Rule, Finding } from './Rule.js';

const DOCS = 'https://docs.powersync.com/migration-guides/streams';

export const legacyBucketDefinitions: Rule = {
  id: 'legacy-bucket-definitions',
  defaultSeverity: 'info',
  check(stream, ctx) {
    const findings: Finding[] = [];
    if (ctx.config.source !== 'bucket_definitions' && ctx.config.source !== 'mixed') return findings;
    if (stream.kind !== 'bucket_definition') return findings;
    findings.push({
      rule: 'legacy-bucket-definitions',
      severity: 'info',
      stream: stream.name,
      message: `\`${stream.name}\` uses the legacy \`bucket_definitions:\` format.`,
      detail: 'The `streams:` format supersedes `bucket_definitions:` — it gives you per-stream priorities, auto-subscribe, and CTE-based parameters in one block.',
      suggestion: 'Migrate this entry to the `streams:` block. See the migration guide for the equivalent shape.',
      docsUrl: DOCS
    });
    return findings;
  }
};
