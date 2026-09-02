import { Flags } from '@oclif/core';

import { HelpGroup } from '../command-types/HelpGroup.js';
import { CLI_FILENAME } from './project-config.js';

export type EnvironmentFlagOptions = {
  /** Flags that cannot be combined with --environment, such as --instance-id. */
  exclusive: string[];
};

export function createEnvironmentFlag(options: EnvironmentFlagOptions) {
  return Flags.string({
    description: `[Cloud] Name of an environment defined in ${CLI_FILENAME} to run against. Resolved: flag → POWERSYNC_ENVIRONMENT.`,
    exclusive: options.exclusive,
    helpGroup: HelpGroup.CLOUD_PROJECT,
    required: false
  });
}
