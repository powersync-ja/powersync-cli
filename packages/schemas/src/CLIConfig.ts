import { BasePowerSyncHostedConfig } from '@powersync/management-types';
import { configFile } from '@powersync/service-types';
import * as t from 'ts-codec';

export const CLICloudConfig = t
  .object({
    _type: t.literal('cloud')
  })
  .and(BasePowerSyncHostedConfig);

export const CLISelfHostedConfig = t
  .object({
    _type: t.literal('self-hosted')
  })
  .and(configFile.powerSyncConfig);

export const CLIConfig = t.union(CLICloudConfig, CLISelfHostedConfig);
