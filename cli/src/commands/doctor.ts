import { Flags, ux } from '@oclif/core';
import { CommandHelpGroup, PowerSyncCommand, SYNC_FILENAME, syncConfigFilePathFlags } from '@powersync/cli-core';
import {
  analyze,
  loadJwtPayload,
  parseJwtPayload,
  renderJson,
  renderText,
  type JwtClaims
} from '@powersync/sync-config-doctor';
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export default class Doctor extends PowerSyncCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description =
    'Run static analysis against a sync configuration to surface bucket-budget pressure and anti-patterns (cartesian filters, subquery explosion, unbounded streams, and more). Optionally probes a live source database for cardinality stats. Local-only — does not call the PowerSync Cloud API.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --output=json',
    '<%= config.bin %> <%= command.id %> --sync-config-file-path ./examples/sync-config.yaml',
    '<%= config.bin %> <%= command.id %> --db postgres://user:pass@localhost/app --jwt ./claims.json',
    '<%= config.bin %> <%= command.id %> --skip-rule subquery-explosion --max-buckets 2000'
  ];
  static flags = {
    ...syncConfigFilePathFlags,
    output: Flags.string({
      default: 'human',
      description: 'Output format.',
      options: ['human', 'json']
    }),
    'array-cardinality': Flags.integer({
      default: 20,
      description: 'Static array-parameter cardinality assumption.'
    }),
    db: Flags.string({
      description:
        'Live source DB URL (postgres://, mysql://, mongodb://) used to gather cardinality stats. Requires --user-id, or a --jwt with a `sub` claim.'
    }),
    'default-cardinality': Flags.integer({
      default: 100,
      description: 'Static subquery cardinality assumption.'
    }),
    exact: Flags.boolean({
      dependsOn: ['db'],
      description: 'Run COUNT(*) for exact row counts instead of the default planner-stats probe (slower on large tables).'
    }),
    'i-know-this-is-prod': Flags.boolean({
      dependsOn: ['db'],
      description:
        'Override the safety check that refuses non-local/staging --db hosts. Probes still run read-only with a short timeout, but use only against a copy or replica.'
    }),
    jwt: Flags.string({
      description: 'JWT payload — inline JSON or file path. `sub` → user id; array claims → auth.parameter() sizes.'
    }),
    'max-buckets': Flags.integer({
      default: 1000,
      description: 'Bucket budget used to score the configuration.'
    }),
    params: Flags.string({
      description: 'JSON object of auth/subscription parameter values (overrides --jwt-derived values).'
    }),
    rule: Flags.string({
      description: 'Enable only this rule (repeatable).',
      multiple: true
    }),
    schema: Flags.string({
      default: 'public',
      description: 'Default schema when none is specified in the sync config.'
    }),
    'skip-rule': Flags.string({
      description: 'Disable this rule (repeatable).',
      multiple: true
    }),
    'user-id': Flags.string({
      description: 'Sample auth user id (required with --db unless --jwt carries a `sub` claim).'
    })
  };
  static summary = 'Analyze a sync configuration for bucket bloat and anti-patterns.';

  async run(): Promise<void> {
    const { flags } = await this.parse(Doctor);

    const filePath = this.resolveSyncConfigPath(flags['sync-config-file-path']);

    let jwt: JwtClaims | undefined;
    if (flags.jwt) {
      try {
        jwt = await loadJwtPayload(flags.jwt);
      } catch (error) {
        this.styledError({ error, exitCode: 3, message: '--jwt could not be loaded' });
      }
    }

    let params: Record<string, unknown> | undefined;
    if (flags.params) {
      try {
        params = JSON.parse(flags.params) as Record<string, unknown>;
      } catch (error) {
        this.styledError({ error, exitCode: 3, message: '--params is not valid JSON' });
      }
    }

    let db: { url: string; userId: string; exact: boolean; allowProd: boolean } | undefined;
    if (flags.db) {
      const userId = flags['user-id'] ?? (jwt ? parseJwtPayload(jwt).userId : undefined);
      if (!userId) {
        this.styledError({
          exitCode: 3,
          message: '--user-id is required when --db is set (or pass --jwt with a `sub` claim).'
        });
      }
      db = {
        url: flags.db,
        userId,
        exact: flags.exact,
        allowProd: flags['i-know-this-is-prod']
      };
    }

    const analyzeOpts: Parameters<typeof analyze>[1] = {
      schema: flags.schema,
      maxBuckets: flags['max-buckets'],
      defaultCardinality: flags['default-cardinality'],
      arrayCardinality: flags['array-cardinality'],
      only: flags.rule ?? [],
      skip: flags['skip-rule'] ?? []
    };
    if (jwt) analyzeOpts.jwt = jwt;
    if (params) analyzeOpts.params = params;
    if (db) analyzeOpts.db = db;

    const report = await analyze(filePath, analyzeOpts);

    const out =
      flags.output === 'json' ? renderJson(report) : renderText(report, { color: process.stdout.isTTY === true });
    this.log(out);

    if (report.exit !== 0) {
      this.exit(report.exit);
    }
  }

  private resolveSyncConfigPath(override: string | undefined): string {
    if (override) {
      return isAbsolute(override) ? override : resolve(process.cwd(), override);
    }

    const defaultPath = join(process.cwd(), SYNC_FILENAME);
    if (!existsSync(defaultPath)) {
      this.styledError({
        exitCode: 3,
        message: `No sync config found at ${defaultPath}.`,
        suggestions: [
          `Pass --sync-config-file-path to point at a specific file.`,
          `Or run this command from a directory containing ${SYNC_FILENAME}.`
        ]
      });
    }
    return defaultPath;
  }
}
