#!/usr/bin/env -S node --import tsx

import { execute } from '@oclif/core';
import { setCliClientHeaders } from '@powersync/cli-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import packageJSON from '../package.json' with { type: 'json' };

setCliClientHeaders({
  'user-agent': `POWERSYNC_CLI/${packageJSON.version}`
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await execute({
  development: true,
  dir: import.meta.url,
  loadOptions: {
    root: path.resolve(__dirname, '..')
  }
});
