import type { CloudProject, SelfHostedProject } from '@powersync/cli-core';

/**
 * Environment variables to be passed from the PowerSync CLI
 */
function parseProjectContextFromEnv(raw: string | undefined):
  | undefined
  | {
      linkedProject: CloudProject | SelfHostedProject;
    } {
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(
      `Failed to parse POWERSYNC_PROJECT_CONTEXT payload: ${error instanceof Error ? error.message : String(error)}`
    );
    return undefined;
  }
}

export const env = {
  POWERSYNC_PROJECT_CONTEXT: parseProjectContextFromEnv(process.env.POWERSYNC_PROJECT_CONTEXT)
};
