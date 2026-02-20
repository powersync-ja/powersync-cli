import { confirm, password } from '@inquirer/prompts';
import { Config } from '@oclif/core';
import { captureOutput } from '@oclif/test';
import * as cliCore from '@powersync/cli-core';
import { Services, StorageImpl } from '@powersync/cli-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { startPATLoginServer } from '../../src/api/login-server.js';
import LoginCommand from '../../src/commands/login.js';
import { root } from '../helpers/root.js';

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
  password: vi.fn()
}));

vi.mock('../../src/api/login-server.js', () => ({
  startPATLoginServer: vi.fn()
}));

const mockedConfirm = vi.mocked(confirm);
const mockedPassword = vi.mocked(password);
const mockedStartPATLoginServer = vi.mocked(startPATLoginServer);
const mockedCreateAccountsHubClient = vi.spyOn(cliCore, 'createAccountsHubClient');

describe('login', () => {
  let oclifConfig: Config;
  const authentication = {
    deleteToken: vi.fn(),
    getToken: vi.fn(),
    setToken: vi.fn()
  };

  beforeAll(async () => {
    oclifConfig = await Config.load({ root });
  });

  beforeEach(() => {
    mockedConfirm.mockReset();
    mockedPassword.mockReset();
    mockedStartPATLoginServer.mockReset();
    mockedCreateAccountsHubClient.mockReset();
    authentication.getToken.mockReset();
    authentication.setToken.mockReset();
    authentication.deleteToken.mockReset();

    authentication.getToken.mockResolvedValue(null);
    authentication.setToken.mockResolvedValue(null);
    authentication.deleteToken.mockResolvedValue(null);

    Services.storage = {
      capabilities: { supportsSecureStorage: true },
      insecureStoragePath: '/tmp/powersync-config.json'
    } as unknown as StorageImpl;
    Services.authentication = authentication as unknown as cliCore.AuthenticationServiceImpl;

    mockedConfirm.mockResolvedValue(false);
    mockedPassword.mockResolvedValue('  test-token  ');
    mockedStartPATLoginServer.mockResolvedValue({
      address: 'http://127.0.0.1:54321',
      tokenPromise: Promise.resolve('server-token')
    });
    mockedCreateAccountsHubClient.mockResolvedValue({
      listOrganizations: vi.fn().mockResolvedValue({
        objects: [{ id: 'org-1', label: 'Org One' }]
      })
    } as unknown as cliCore.AccountsHubClientSDKClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function runLoginDirect() {
    const cmd = new LoginCommand([], oclifConfig);
    return captureOutput(() => cmd.run());
  }

  it('stores a valid token from prompt when browser flow is declined', async () => {
    mockedConfirm.mockResolvedValueOnce(true); // openBrowser
    mockedPassword.mockImplementationOnce(() => Object.assign(Promise.resolve('test-token'), { cancel: vi.fn() }));
    const result = await runLoginDirect();

    expect(result.error).toBeUndefined();
    expect(authentication.setToken).toHaveBeenCalledWith('server-token');
    expect(authentication.deleteToken).not.toHaveBeenCalled();
    expect(mockedStartPATLoginServer).toHaveBeenCalledTimes(1);
    expect(result.stdout).toContain('Token stored successfully.');
    expect(result.stdout).toContain('Token is valid.');
  });

  it('cancels login when secure storage is unavailable and fallback is declined', async () => {
    Services.storage = {
      capabilities: { supportsSecureStorage: false },
      insecureStoragePath: '/tmp/powersync-config.json'
    } as unknown as StorageImpl;
    mockedConfirm.mockResolvedValueOnce(false); // insecure fallback prompt

    const result = await runLoginDirect();

    expect(result.error?.oclif?.exit).toBe(0);
    expect(authentication.setToken).not.toHaveBeenCalled();
    expect(result.stdout).toContain('Login cancelled.');
  });

  it('deletes token and errors when token validation fails', async () => {
    mockedConfirm.mockResolvedValueOnce(true); // openBrowser
    mockedPassword.mockImplementationOnce(() => Object.assign(Promise.resolve('test-token'), { cancel: vi.fn() }));
    authentication.setToken.mockRejectedValueOnce(new Error('unauthorized'));

    const result = await runLoginDirect();

    expect(result.error).toBeDefined();
    expect(authentication.setToken).toHaveBeenCalledWith('server-token');
    expect(authentication.deleteToken).toHaveBeenCalledTimes(1);
    expect(result.error?.message).toContain('Invalid token. Please try again.');
  });
});
