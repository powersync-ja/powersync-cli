import { postgresBackend } from './postgres.js';
import { mysqlBackend } from './mysql.js';
import { mongoBackend } from './mongo.js';
import { assertSafeUrl } from './safety.js';
import type { ProbeBackend, ProbeOptions, ProbeResult } from './types.js';

export type { ProbeResult, ProbeOptions, TableStats } from './types.js';
export { assertSafeUrl, hostLooksSafe, UnsafeUrlError, type ProbeMode } from './safety.js';

const BACKENDS: ProbeBackend[] = [postgresBackend, mysqlBackend, mongoBackend];

export async function probe(
  opts: ProbeOptions & { allowProd?: boolean },
  tables: string[]
): Promise<ProbeResult> {
  assertSafeUrl(opts.url, { override: opts.allowProd });
  const protocol = opts.url.split(':', 1)[0]?.toLowerCase() ?? '';
  const backend = BACKENDS.find((b) => b.protocols.includes(protocol));
  if (!backend) {
    throw new Error(
      `No probe backend for protocol "${protocol}". Supported: ${BACKENDS.flatMap((b) => b.protocols).join(', ')}`
    );
  }
  return backend.probe(opts, tables);
}
