import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Package root (packages/cli) so runCommand loads Config from the correct place. */
export const root = resolve(__dirname, '../..');
