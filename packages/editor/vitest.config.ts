import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Separate config so tests don't load the app plugins (nitro, tanstack start)
// from vite.config.ts, which spin up servers that block vitest from exiting.
const config = defineConfig({
  plugins: [viteReact()],
  resolve: {
    tsconfigPaths: true
  },
  test: {
    environment: 'jsdom'
  }
});

export default config;
