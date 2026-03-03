import { runCommand } from '@oclif/test';
import { describe, expect, it } from 'vitest';

import { root } from '../helpers/root.js';

describe('help', () => {
  it('shows a grouped command list at root help', async () => {
    const result = await runCommand('--help', { root });

    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain('POWERSYNC COMMANDS');
    expect(result.stdout).toContain('CLOUD COMMANDS');
    expect(result.stdout).toContain('SHARED COMMANDS');
    expect(result.stdout).toContain('SELF-HOSTED COMMANDS');
    expect(result.stdout).toContain('OTHER COMMANDS');
    expect(result.stdout).toContain('deploy service-config');
    expect(result.stdout).toContain('fetch status');
    expect(result.stdout).toContain('docker start');
    expect(result.stdout).toContain('plugins add');
    expect(result.stdout).toMatch(/deploy sync-config[\s\S]*\n\n\s+destroy\s+/);
    expect(result.stdout).not.toContain('TOPICS');

    const cloudSectionStart = result.stdout.indexOf('CLOUD COMMANDS');
    const selfHostedSectionStart = result.stdout.indexOf('SELF-HOSTED COMMANDS');
    const pluginSectionStart = result.stdout.indexOf('OTHER COMMANDS');

    const cloudSection = result.stdout.slice(cloudSectionStart, selfHostedSectionStart);
    const selfHostedSection = result.stdout.slice(selfHostedSectionStart, pluginSectionStart);
    const pluginSection = result.stdout.slice(pluginSectionStart);

    expect(cloudSection).toContain('deploy service-config');
    expect(selfHostedSection).toContain('docker start');
    expect(pluginSection).not.toContain('docker start');
  });
});
