import { includeIgnoreFile } from '@eslint/compat';
import oclif from 'eslint-config-oclif';
import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const gitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.gitignore');
const rootGitignorePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.gitignore');

export default [
  includeIgnoreFile(gitignorePath),
  includeIgnoreFile(rootGitignorePath),
  ...oclif,
  prettier,
  {
    rules: {
      // fs.cp/cpSync available since Node 16.7.0; engine is >=18
      'n/no-unsupported-features/node-builtins': 'off'
    }
  }
];
