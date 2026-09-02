import { Command, ux } from '@oclif/core';
import { PowerSyncManagementClient } from '@powersync/management-client';

import type { CloudProject } from '../command-types/CloudInstanceCommand.js';
import type { SelfHostedProject } from '../command-types/SelfHostedInstanceCommand.js';

export type LogTargetInstanceParams = {
  client: PowerSyncManagementClient;
  command: Command;
  /** Skips the lookup when the Cloud instance name is already known, for example from getInstanceConfig. */
  instanceName?: string;
  project: CloudProject | SelfHostedProject;
};

/**
 * Prints which instance a command is about to act on, so users can confirm the target before anything happens.
 *
 * For Cloud projects the name is fetched from the Management API unless it is given. If that fails, the IDs
 * are still printed and the command continues; a later API call surfaces the real error. Self-hosted projects
 * have no instance name, so the API URL is printed instead.
 *
 * @returns A short label for later messages: "name (id)", the id alone when the name is unavailable, or the
 * API URL for self-hosted projects.
 */
export async function logTargetInstance(params: LogTargetInstanceParams): Promise<string> {
  const { client, command, project } = params;
  const { linked } = project;

  if (linked.type === 'self-hosted') {
    command.log(`Target instance: ${ux.colorize('blue', linked.api_url)} ${ux.colorize('gray', '(self-hosted)')}`);
    return linked.api_url;
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
  const environment = 'environment' in project ? project.environment : undefined;
  const environmentLabel = environment ? ` ${ux.colorize('gray', `environment: ${environment}`)}` : '';
  command.log(`Target instance: ${nameLabel} ${ux.colorize('gray', `id: ${linked.instance_id}`)}${environmentLabel}`);
  command.log(
    `\t${ux.colorize('gray', `project: ${linked.project_id}`)} ${ux.colorize('gray', `org: ${linked.org_id}`)}`
  );

  return instanceName == null ? linked.instance_id : `${instanceName} (${linked.instance_id})`;
}
