import { BasePowerSyncHostedConfig } from '@powersync/management-types';
import { MergedServiceConfig } from '@powersync/service-schema';
import * as t from 'ts-codec';

export const CLICloudConfig = t
  .object({
    _type: t.literal('cloud'),
    /** The instance name */
    name: t.string
  })
  .and(BasePowerSyncHostedConfig);
export type CLICloudConfig = t.Encoded<typeof CLICloudConfig>;
export type CLICloudConfigDecoded = t.Decoded<typeof CLICloudConfig>;

export const CLISelfHostedConfig = t
  .object({
    _type: t.literal('self-hosted')
  })
  .and(MergedServiceConfig);

export type CLISelfHostedConfig = t.Encoded<typeof CLISelfHostedConfig>;
export type CLISelfHostedConfigDecoded = t.Decoded<typeof CLISelfHostedConfig>;

export const CLIConfig = t.union(CLICloudConfig, CLISelfHostedConfig);
export type CLIConfig = t.Encoded<typeof CLIConfig>;
export type CLIConfigDecoded = t.Decoded<typeof CLIConfig>;
