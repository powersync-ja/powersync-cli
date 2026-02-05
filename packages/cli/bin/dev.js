#!/usr/bin/env -S node --import tsx

import { execute } from '@oclif/core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await execute({
  development: true,
  dir: import.meta.url,
  loadOptions: {
    root: path.resolve(__dirname, '..')
  }
});
