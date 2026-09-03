import { Flags } from '@oclif/core';

import { HelpGroup } from '../command-types/HelpGroup.js';
import { CLI_FILENAME } from './project-config.js';

export type TargetFlagOptions = {
  /** Flags that cannot be combined with --target, such as --instance-id. */
  exclusive: string[];
};

export function createTargetFlag(options: TargetFlagOptions) {
  return Flags.string({
    description: `Name of a target defined in ${CLI_FILENAME} to run against. Resolved: flag → POWERSYNC_TARGET.`,
    exclusive: options.exclusive,
    helpGroup: HelpGroup.CLOUD_PROJECT,
    required: false
  });
}
