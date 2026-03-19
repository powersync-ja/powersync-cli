import { includeIgnoreFile } from '@eslint/compat';
import oclif from 'eslint-config-oclif';
import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore');

/**
 * Base ESLint config for the monorepo.
 * Each package should have its own eslint.config.mjs that spreads this config
 * and adds package-specific overrides.
 */
export default [
  includeIgnoreFile(gitignorePath),
  { ignores: ['examples/**'] },
  ...oclif,
  prettier,
  {
    rules: {
      // Allow PascalCase factory/mixin calls (e.g. WithSyncConfigFilePath(Base)) without `new`.
      'new-cap': ['error', { capIsNew: false, newIsCap: true }],
      camelcase: 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'n/no-unsupported-features/node-builtins': 'off',
      'no-await-in-loop': 'off',
      'no-eq-null': 'off',
      'no-multi-assign': 'off',
      'unicorn/filename-case': 'off'
    }
  }
];
