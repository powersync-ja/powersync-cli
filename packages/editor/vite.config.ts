import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const config = defineConfig({
  optimizeDeps: {
    include: ['path-browserify']
  },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//], treeshake: true } }),
    tailwindcss(),
    tanstackStart({}),
    viteReact()
  ],
  resolve: {
    tsconfigPaths: true
  }
});

export default config;
