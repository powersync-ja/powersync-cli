import { Flags } from '@oclif/core';

import { HelpGroup } from '../command-types/HelpGroup.js';
import { CLI_FILENAME } from './project-config.js';

export function createEnvironmentFlag(exclusive: string[]) {
  return Flags.string({
    description: `[Cloud] Name of an environment defined in ${CLI_FILENAME} to run against. Resolved: flag → POWERSYNC_ENVIRONMENT.`,
    exclusive,
    helpGroup: HelpGroup.CLOUD_PROJECT,
    required: false
  });
}
