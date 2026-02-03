import { Flags } from '@oclif/core';

/** Directory containing PowerSync config (default: powersync). Used by init and link. */
export const directoryFlag = Flags.string({
  default: 'powersync',
  description: 'Directory containing PowerSync config (default: powersync).'
});

/** Shared flags for commands that target a PowerSync project directory. */
export const commonFlags = {
  directory: directoryFlag
};
