import {
  createAccountsHubClient,
  createSelfHostedClient,
  env,
  Services,
  setCliClientHeaders
} from '@powersync/cli-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('cli client headers', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.resetModules();

    // Ensure the accounts client has a token available.
    env.PS_ADMIN_TOKEN = 'test-token';
    vi.spyOn(Services.authentication, 'getToken').mockResolvedValue('test-token');

    // Spy on fetch with endpoint-specific responses so SDK calls settle.
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/api/admin/v1/diagnostics')) {
        return new Response(JSON.stringify({ data: { connections: [] } }), {
          headers: { 'content-type': 'application/json' },
          status: 200
        });
      }

      if (url.includes('/api/accounts/v5/organizations/get')) {
        return new Response(JSON.stringify({ id: 'org', label: 'test' }), {
          headers: { 'content-type': 'application/json' },
          status: 200
        });
      }

      return new Response('{}', {
        headers: { 'content-type': 'application/json' },
        status: 200
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    env.PS_ADMIN_TOKEN = undefined;
  });

  test('applies CLI headers across self-hosted, accounts, and cloud clients', async () => {
    setCliClientHeaders({ 'user-agent': 'POWERSYNC_CLI/test', 'x-custom': 'value' });

    // We don't use a cloud client directly, since that is mocked other tests' convinience.
    const selfHosted = createSelfHostedClient({ apiKey: 'key', apiUrl: 'test-url' });
    const accounts = createAccountsHubClient();

    await Promise.all([selfHosted.diagnostics({}), accounts.getOrganization({ id: 'org' })]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const headerSets: Headers[] = fetchSpy.mock.calls.map(
      (args: [unknown, { headers?: Record<string, string> }?]) => new Headers(args[1]?.headers)
    );

    for (const headers of headerSets) {
      expect(headers.get('user-agent')).toEqual('POWERSYNC_CLI/test');
      expect(headers.get('x-custom')).toEqual('value');
    }
  });
});
