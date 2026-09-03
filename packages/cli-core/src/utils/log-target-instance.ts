import { ux } from '@oclif/core';
import { PowerSyncManagementClient } from '@powersync/management-client';

import type { CloudProject } from '../command-types/CloudInstanceCommand.js';
import type { SelfHostedProject } from '../command-types/SelfHostedInstanceCommand.js';

/** Labels an instance as "name (id)" when the name is known, otherwise as the id alone. */
export function formatInstanceLabel(instanceId: string, instanceName?: string): string {
  return instanceName == null ? instanceId : `${instanceName} (${instanceId})`;
}

export type LogTargetInstanceParams = {
  client: PowerSyncManagementClient;
  /** Skips the lookup when the Cloud instance name is already known, for example from getInstanceConfig. */
  instanceName?: string;
  log: (message: string) => void;
  project: CloudProject | SelfHostedProject;
};

/**
 * Prints which instance a command is about to act on, so users can confirm the target before anything happens.
 *
 * For Cloud projects the name is fetched from the Management API unless it is given. If that fails, the IDs
 * are still printed and the command continues; a later API call surfaces the real error. Self-hosted projects
 * have no instance name, so the API URL is printed instead.
 *
 * @returns The Cloud instance name, or undefined if it is unavailable or the project is self-hosted.
 */
export async function logTargetInstance(params: LogTargetInstanceParams): Promise<string | undefined> {
  const { client, log, project } = params;
  const { linked } = project;

  if (linked.type === 'self-hosted') {
    log(`Target instance: ${ux.colorize('blue', linked.api_url)} ${ux.colorize('gray', '(self-hosted)')}`);
    return;
  }

  let { instanceName } = params;
  if (instanceName == null) {
    try {
      ({ name: instanceName } = await client.getInstance({ id: linked.instance_id }));
    } catch {
      // Fall through, IDs are still printed below.
    }
  }

  const nameLabel =
    instanceName == null ? ux.colorize('yellow', '(name unavailable)') : ux.colorize('blue', instanceName);
  log(`Target instance: ${nameLabel} ${ux.colorize('gray', `id: ${linked.instance_id}`)}`);
  log(`\t${ux.colorize('gray', `project: ${linked.project_id}`)} ${ux.colorize('gray', `org: ${linked.org_id}`)}`);

  return instanceName;
}
