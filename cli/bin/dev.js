#!/usr/bin/env -S node --import tsx

import { execute } from '@oclif/core';
import { setCliClientHeaders } from '@powersync/cli-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import packageJSON from '../package.json' with { type: 'json' };

setCliClientHeaders({
  'user-agent': `POWERSYNC_CLI/${packageJSON.version}`
});

// Ensure pnpm scripts run in the shell's original cwd (pnpm sets INIT_CWD for this).
if (process.env.INIT_CWD && process.env.INIT_CWD !== process.cwd()) {
  process.chdir(process.env.INIT_CWD);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await execute({
  development: true,
  // Force oclif to ignore the baked manifest so it resolves commands from TS via tsx.
  loadOptions: {
    ignoreManifest: true,
    root: path.resolve(__dirname, '..')
  }
});
