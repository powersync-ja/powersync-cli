import { ServiceCloudConfigDecoded } from '@powersync/cli-schemas';
import { routes } from '@powersync/management-types';
import { describe, expect, it } from 'vitest';

import { changedServiceConfigSections, formatSyncConfigDiff } from '../../src/api/dry-run.js';

const ANSI_SEQUENCE = new RegExp(`${String.fromCodePoint(27)}\\[[\\d;]*m`, 'g');
const stripAnsi = (line: string) => line.replaceAll(ANSI_SEQUENCE, '');

const DEPLOYED_CONFIG = {
  region: 'us',
  replication: { connections: [{ name: 'default', type: 'postgresql', uri: 'postgres://user:pass@host/db' }] }
};

const cloudState = (config: unknown) =>
  ({ config, id: 'instance', name: 'test-instance', sync_rules: '' }) as unknown as routes.InstanceConfigResponse;

const localConfig = (overrides: Record<string, unknown> = {}) =>
  ({ _type: 'cloud', name: 'test-instance', ...DEPLOYED_CONFIG, ...overrides }) as ServiceCloudConfigDecoded;

describe('dry run helpers', () => {
  it('formatSyncConfigDiff returns nothing for identical sync config', () => {
    expect(formatSyncConfigDiff('a: 1\n', 'a: 1\n')).toEqual([]);
  });

  it('formatSyncConfigDiff returns unified diff lines', () => {
    const lines = formatSyncConfigDiff('a: 1\nb: 2\n', 'a: 1\nc: 3\n').map((line) => stripAnsi(line));
    expect(lines).toEqual(['@@ -1,2 +1,2 @@', ' a: 1', '-b: 2', '+c: 3']);
  });

  it('changedServiceConfigSections ignores the name and reports differing sections', () => {
    expect(changedServiceConfigSections(localConfig({ name: 'renamed' }), cloudState(DEPLOYED_CONFIG))).toEqual([]);

    const changed = localConfig({
      replication: { connections: [{ name: 'default', type: 'postgresql', uri: 'postgres://user:pass@other/db' }] }
    });
    expect(changedServiceConfigSections(changed, cloudState(DEPLOYED_CONFIG))).toEqual(['replication']);
  });

  it('changedServiceConfigSections returns undefined when the deployed config cannot be decoded', () => {
    expect(changedServiceConfigSections(localConfig(), cloudState({ region: 42 }))).toBeUndefined();
  });
});
