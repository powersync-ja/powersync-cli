import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // https://oclif.io/docs/testing/#capturing-stdout-and-stderr-with-vitest
    disableConsoleIntercept: true
  }
})
