import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // https://oclif.io/docs/testing/#capturing-stdout-and-stderr-with-vitest
    disableConsoleIntercept: true,
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
    setupFiles: ['./test/setup.ts']
  }
});
