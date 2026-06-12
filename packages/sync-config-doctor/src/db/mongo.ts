import { emptyResult, type ProbeBackend, type ProbeOptions, type ProbeResult } from './types.js';

export const mongoBackend: ProbeBackend = {
  protocols: ['mongodb', 'mongodb+srv'],
  async probe(opts: ProbeOptions, tables: string[]): Promise<ProbeResult> {
    const result = emptyResult(opts.mode);
    let mod: typeof import('mongodb');
    try {
      mod = await import('mongodb');
    } catch {
      throw new Error('MongoDB probing requires `mongodb` to be installed. Run: pnpm add mongodb');
    }
    const client = new mod.MongoClient(opts.url);
    await client.connect();
    try {
      const db = client.db();
      const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name.toLowerCase()));

      for (const table of tables) {
        if (!existing.has(table.toLowerCase())) {
          result.skipped.push({ table, reason: 'collection not found' });
          continue;
        }
        try {
          const coll = db.collection(table);
          // collStats reports storageSize, count and avgObjSize without scanning documents.
          const stats = (await db.command({ collStats: table })) as {
            count?: number;
            size?: number;
            storageSize?: number;
            avgObjSize?: number;
          };
          let rows = Number(stats.count ?? 0);
          const bytes = Number(stats.storageSize ?? stats.size ?? 0);
          let exact = false;
          if (opts.mode === 'exact') {
            rows = await coll.countDocuments({});
            exact = true;
          }
          result.tables[table.toLowerCase()] = {
            table,
            rows,
            bytes,
            avgRowSize: Number(stats.avgObjSize ?? (rows > 0 ? bytes / rows : 0)),
            exact
          };
          result.notes.push(`${table}: ${rows} docs, ${bytes} bytes${exact ? ' (exact)' : ' (collStats)'}`);
        } catch (e) {
          result.skipped.push({ table, reason: (e as Error).message });
        }
      }

      const userTable = opts.userTable ?? 'users';
      try {
        if (existing.has(userTable.toLowerCase())) {
          const coll = db.collection(userTable);
          result.userCount =
            opts.mode === 'exact'
              ? await coll.countDocuments({})
              : await coll.estimatedDocumentCount();
          result.notes.push(`user collection "${userTable}": ${result.userCount} users`);
        }
      } catch {
        // best-effort
      }
    } finally {
      await client.close();
    }
    return result;
  }
};
