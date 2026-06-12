import { emptyResult, type ProbeBackend, type ProbeOptions, type ProbeResult } from './types.js';

export const mysqlBackend: ProbeBackend = {
  protocols: ['mysql', 'mariadb'],
  async probe(opts: ProbeOptions, tables: string[]): Promise<ProbeResult> {
    const result = emptyResult(opts.mode);
    let mod: typeof import('mysql2/promise');
    try {
      mod = await import('mysql2/promise');
    } catch {
      throw new Error('MySQL probing requires `mysql2` to be installed. Run: pnpm add mysql2');
    }
    const conn = await mod.createConnection(opts.url);
    try {
      await conn.query('SET SESSION TRANSACTION READ ONLY');
      await conn.query('SET SESSION max_execution_time = 5000');

      for (const table of tables) {
        try {
          // information_schema gives both estimated rows and byte size without scanning.
          const [rows] = await conn.query<import('mysql2').RowDataPacket[]>(
            `SELECT table_rows AS rows_est, (data_length + index_length) AS bytes
             FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
            [opts.schema, table]
          );
          const row = (rows as unknown as { rows_est: number; bytes: number }[])[0];
          let rowCount = Number(row?.rows_est ?? 0);
          const bytes = Number(row?.bytes ?? 0);
          let exact = false;
          if (opts.mode === 'exact') {
            const [c] = await conn.query<import('mysql2').RowDataPacket[]>(
              `SELECT COUNT(*) AS n FROM \`${opts.schema}\`.\`${table}\``
            );
            rowCount = Number((c as unknown as { n: number }[])[0]?.n ?? 0);
            exact = true;
          }
          result.tables[table.toLowerCase()] = {
            table,
            rows: rowCount,
            bytes,
            avgRowSize: rowCount > 0 ? bytes / rowCount : 0,
            exact
          };
          result.notes.push(`${table}: ${rowCount} rows, ${bytes} bytes${exact ? ' (exact)' : ' (planner)'}`);
        } catch (e) {
          result.skipped.push({ table, reason: (e as Error).message });
        }
      }

      const userTable = opts.userTable ?? 'users';
      try {
        if (opts.mode === 'exact') {
          const [c] = await conn.query<import('mysql2').RowDataPacket[]>(
            `SELECT COUNT(*) AS n FROM \`${opts.schema}\`.\`${userTable}\``
          );
          result.userCount = Number((c as unknown as { n: number }[])[0]?.n ?? 0);
        } else {
          const [r] = await conn.query<import('mysql2').RowDataPacket[]>(
            `SELECT table_rows AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
            [opts.schema, userTable]
          );
          const n = Number((r as unknown as { n: number }[])[0]?.n ?? 0);
          if (n > 0) result.userCount = n;
        }
        if (result.userCount != null) result.notes.push(`user table "${userTable}": ${result.userCount} users`);
      } catch {
        // best-effort
      }
    } finally {
      await conn.end();
    }
    return result;
  }
};
