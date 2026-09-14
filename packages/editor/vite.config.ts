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
    nitro({ rollupConfig: { external: [/^@sentry\//, /^@oclif\/core(\/|$)/], treeshake: true } }),
    tailwindcss(),
    tanstackStart({}),
    viteReact()
  ],
  resolve: {
    tsconfigPaths: true
  },
  // `@oclif/core` is CommonJS and lazily `require()`s its own dependencies (for example
  // `minimatch` from its plugin loader). Inlining it into the server bundle moves those
  // `require()` calls out of its own `node_modules` context, so at runtime they resolve
  // relative to `editor-dist/` and fail under strict (non-hoisted) installs.
  // Keep it external so it is loaded from the published plugin's own `node_modules`.
  ssr: {
    external: ['@oclif/core']
  }
});

export default config;
