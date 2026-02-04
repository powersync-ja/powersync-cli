import { BasePowerSyncHostedConfig } from '@powersync/management-types';
import { configFile } from '@powersync/service-types';
import * as t from 'ts-codec';

export const CLICloudConfig = t
  .object({
    _type: t.literal('cloud')
  })
  .and(BasePowerSyncHostedConfig);
export type CLICloudConfig = t.Encoded<typeof CLICloudConfig>;
export type CLICloudConfigDecoded = t.Decoded<typeof CLICloudConfig>;

export const CLISelfHostedConfig = t
  .object({
    _type: t.literal('self-hosted')
  })
  .and(configFile.powerSyncConfig);

export type CLISelfHostedConfig = t.Encoded<typeof CLISelfHostedConfig>;
export type CLISelfHostedConfigDecoded = t.Decoded<typeof CLISelfHostedConfig>;

export const CLIConfig = t.union(CLICloudConfig, CLISelfHostedConfig);
export type CLIConfig = t.Encoded<typeof CLIConfig>;
export type CLIConfigDecoded = t.Decoded<typeof CLIConfig>;
