#!/usr/bin/env node

import { execute } from '@oclif/core';
import { setCliClientHeaders } from '@powersync/cli-core';

import packageJSON from '../package.json' with { type: 'json' };

setCliClientHeaders({
  'user-agent': `POWERSYNC_CLI/${packageJSON.version}`
});

await execute({ dir: import.meta.url });
