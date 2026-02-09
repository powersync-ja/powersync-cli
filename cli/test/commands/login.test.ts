import { runCommand } from '@oclif/test';
import { describe, expect, it, vi } from 'vitest';

import { root } from '../helpers/root.js';

vi.mock('@inquirer/prompts', () => ({
  password: vi.fn(() => Promise.resolve('test-token'))
}));

vi.mock('../../src/services/SecureStorage.js', () => ({
  getSecureStorage: () => ({
    getToken: () => Promise.resolve(null),
    setToken: () => Promise.resolve(),
    deleteToken: () => Promise.resolve()
  })
}));

describe('login', () => {
  it.skip('prompts for token and stores it', async () => {
    // Skipped: runCommand loads CLI from dist, so @inquirer/prompts mock is not applied and test hangs on password prompt
    const { stdout } = await runCommand('login', { root });
    expect(stdout).toContain('Token stored successfully.');
  });
});
