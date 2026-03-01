import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const config = defineConfig({
  optimizeDeps: {
    include: ['path-browserify']
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//], treeshake: true } }),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart({}),
    viteReact()
  ],
  resolve: {
    alias: {
      buffer: 'buffer'
    }
  }
});

export default config;
