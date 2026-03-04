import { runCommand } from '@oclif/test';
import { describe, expect, it } from 'vitest';

import { root } from '../helpers/root.js';

describe('help', () => {
  it('shows a grouped command list at root help', async () => {
    const result = await runCommand('--help', { root });

    expect(result.error).toBeUndefined();
    expect(result.stdout).toContain('AUTHENTICATION COMMANDS');
    expect(result.stdout).toContain('PROJECT SETUP COMMANDS');
    expect(result.stdout).toContain('CLOUD COMMANDS');
    expect(result.stdout).toContain('INSTANCE COMMANDS');
    expect(result.stdout).toContain('LOCAL DEVELOPMENT COMMANDS');
    expect(result.stdout).toContain('ADDITIONAL COMMANDS');
    expect(result.stdout).toContain('deploy service-config');
    expect(result.stdout).toContain('fetch status');
    expect(result.stdout).toContain('docker start');
    expect(result.stdout).toContain('plugins add');
    const deployServiceIdx = result.stdout.indexOf('deploy service-config');
    const deploySyncIdx = result.stdout.indexOf('deploy sync-config');
    const destroyIdx = result.stdout.indexOf('destroy');
    expect(deployServiceIdx).toBeLessThan(deploySyncIdx);
    expect(deploySyncIdx).toBeLessThan(destroyIdx);
    expect(result.stdout).not.toContain('TOPICS');

    const cloudSectionStart = result.stdout.indexOf('CLOUD COMMANDS');
    const instanceSectionStart = result.stdout.indexOf('INSTANCE COMMANDS');
    const localDevSectionStart = result.stdout.indexOf('LOCAL DEVELOPMENT COMMANDS');
    const additionalSectionStart = result.stdout.indexOf('ADDITIONAL COMMANDS');

    const cloudSection = result.stdout.slice(cloudSectionStart, instanceSectionStart);
    const localDevSection = result.stdout.slice(localDevSectionStart, additionalSectionStart);
    const additionalSection = result.stdout.slice(additionalSectionStart);

    expect(cloudSection).toContain('deploy service-config');
    expect(localDevSection).toContain('docker start');
    expect(additionalSection).not.toContain('docker start');
  });
});
