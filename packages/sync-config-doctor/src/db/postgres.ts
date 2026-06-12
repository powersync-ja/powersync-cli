import { emptyResult, type ProbeBackend, type ProbeOptions, type ProbeResult } from './types.js';

export const postgresBackend: ProbeBackend = {
  protocols: ['postgres', 'postgresql'],
  async probe(opts: ProbeOptions, tables: string[]): Promise<ProbeResult> {
    const result = emptyResult(opts.mode);
    let pg: typeof import('pg');
    try {
      pg = await import('pg');
    } catch {
      throw new Error('Postgres probing requires `pg` to be installed. Run: pnpm add pg');
    }
    const client = new pg.default.Client({ connectionString: opts.url });
    await client.connect();
    try {
      // Read-only + short timeout: a probe must never block writers or run away on a big table.
      await client.query('BEGIN READ ONLY');
      await client.query("SET LOCAL statement_timeout = '5s'");

      for (const table of tables) {
        const ident = `"${opts.schema}"."${table}"`;
        const reg = `${opts.schema}.${table}`;
        try {
          const sizeRes = await client.query<{ bytes: string | null }>(
            `SELECT pg_total_relation_size(to_regclass($1))::bigint AS bytes`,
            [reg]
          );
          const bytes = Number(sizeRes.rows[0]?.bytes ?? 0);

          let rows: number;
          let exact = false;
          if (opts.mode === 'exact') {
            const countRes = await client.query<{ n: string }>(`SELECT COUNT(*)::bigint AS n FROM ${ident}`);
            rows = Number(countRes.rows[0]?.n ?? 0);
            exact = true;
          } else {
            const statRes = await client.query<{ reltuples: number }>(
              `SELECT GREATEST(reltuples, 0)::bigint AS reltuples FROM pg_class WHERE oid = to_regclass($1)`,
              [reg]
            );
            rows = Number(statRes.rows[0]?.reltuples ?? 0);
          }

          result.tables[table.toLowerCase()] = {
            table,
            rows,
            bytes,
            avgRowSize: rows > 0 ? bytes / rows : 0,
            exact
          };
          result.notes.push(`${table}: ${rows} rows, ${bytes} bytes${exact ? ' (exact)' : ' (planner)'}`);
        } catch (e) {
          result.skipped.push({ table, reason: (e as Error).message });
        }
      }

      const userTable = opts.userTable ?? 'users';
      try {
        const uref = `${opts.schema}.${userTable}`;
        if (opts.mode === 'exact') {
          const r = await client.query<{ n: string }>(`SELECT COUNT(*)::bigint AS n FROM "${opts.schema}"."${userTable}"`);
          result.userCount = Number(r.rows[0]?.n ?? 0);
        } else {
          const r = await client.query<{ reltuples: number }>(
            `SELECT GREATEST(reltuples, 0)::bigint AS reltuples FROM pg_class WHERE oid = to_regclass($1)`,
            [uref]
          );
          const n = Number(r.rows[0]?.reltuples ?? 0);
          if (n > 0) result.userCount = n;
        }
        if (result.userCount != null) result.notes.push(`user table "${userTable}": ${result.userCount} users`);
      } catch {
        // User-count discovery is best-effort; --users can supply it explicitly.
      }

      await client.query('COMMIT');
    } finally {
      await client.end();
    }
    return result;
  }
};
