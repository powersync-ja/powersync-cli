import type { ResolvedCloudCLIConfig } from '@powersync/cli-schemas';
import type { PowerSyncManagementClient } from '@powersync/management-client';

import { routes } from '@powersync/management-types';

export type TestConnectionResult = {
  connectionName: string;
  response: routes.TestConnectionResponse;
};

/**
 * Tests each database connection from the config against PowerSync Cloud.
 * Uses the instance ID so secret_refs can be resolved.
 */
export async function testCloudConnections(
  client: PowerSyncManagementClient,
  linked: ResolvedCloudCLIConfig,
  connections: Array<Record<string, unknown> & { name?: string }>
): Promise<TestConnectionResult[]> {
  const results: TestConnectionResult[] = [];
  for (const connection of connections) {
    const response = await client.testConnection(
      routes.TestConnectionRequest.encode({
        app_id: linked.project_id,
        connection: connection as Parameters<typeof routes.TestConnectionRequest.encode>[0]['connection'],
        id: linked.instance_id,
        org_id: linked.org_id
      })
    );
    results.push({
      connectionName: connection.name ?? 'unnamed',
      response
    });
  }

  return results;
}

/** Pretty-print test connection response for error output. */
export function formatTestConnectionFailure(response: routes.TestConnectionResponse, connectionName: string): string {
  const lines: string[] = [
    `Failed to test connection for connection "${connectionName}":`,
    '',
    '  Overall success: ' + String(response.success),
    '  Error: ' + (response.error ?? '(none)'),
    '',
    '  Checks:',
    '    • connection.success: ' + String(response.connection?.success ?? '—'),
    '    • connection.reachable: ' + String(response.connection?.reachable ?? '—'),
    '    • configuration.success: ' + String(response.configuration?.success ?? '—')
  ];
  return lines.join('\n');
}
