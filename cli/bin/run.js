#!/usr/bin/env node

import { execute } from '@oclif/core';
import { setCloudClientHeaders } from '@powersync/cli-core';

import packageJSON from '../package.json' with { type: 'json' };

setCloudClientHeaders({
  'user-agent': `POWERSYNC_CLI/${packageJSON.version}`
});

await execute({ dir: import.meta.url });
