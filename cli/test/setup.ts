import { Config } from '@oclif/core';
import { vi } from 'vitest';

import { root } from './helpers/root.js';

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(() => Promise.resolve('!env PS_TOKEN')),
  password: vi.fn(() => Promise.resolve('test-token'))
}));

/**
 * Load Config from package root so runCommand uses the correct root.
 * Fails fast if config cannot be loaded.
 */
await Config.load({ root });
