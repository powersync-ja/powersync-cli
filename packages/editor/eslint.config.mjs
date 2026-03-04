import path from 'node:path';
import { fileURLToPath } from 'node:url';

import rootConfig from '../../eslint.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  ...rootConfig,
  { ignores: ['.output/**', '.nitro/**', '.tanstack/**', '.vinxi/**', '.wrangler/**', 'src/routeTree.gen.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: path.resolve(__dirname, 'tsconfig.json')
        }
      }
    }
  }
];
