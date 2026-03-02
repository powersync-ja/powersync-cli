import { defineConfig } from 'vitest/config';

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
