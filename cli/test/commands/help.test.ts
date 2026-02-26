import { runCommand } from '@oclif/test';
import { describe, expect, it } from 'vitest';

import { root } from '../helpers/root.js';

describe('help', () => {
  it('shows a flat command list at root help', async () => {
    const result = await runCommand('--help', { root });

    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain('POWERSYNC COMMANDS');
    expect(result.stdout).toContain('OTHER COMMANDS');
    expect(result.stdout).toContain('deploy service-config');
    expect(result.stdout).toContain('fetch status');
    expect(result.stdout).toContain('docker start');
    expect(result.stdout).toContain('plugins add');
    expect(result.stdout).toMatch(/deploy sync-config[\s\S]*\n\n\s+destroy\s+/);
    expect(result.stdout).not.toContain('TOPICS');

    const mainSectionStart = result.stdout.indexOf('POWERSYNC COMMANDS');
    const pluginSectionStart = result.stdout.indexOf('OTHER COMMANDS');
    const mainSection = result.stdout.slice(mainSectionStart, pluginSectionStart);
    const pluginSection = result.stdout.slice(pluginSectionStart);

    expect(mainSection).toContain('docker start');
    expect(pluginSection).not.toContain('docker start');
  });
});
