import * as t from 'ts-codec';

import { BasePowerSyncHostedConfig } from '@powersync/management-types';
import { configFile } from '@powersync/service-types';

export const CLICloudConfig = BasePowerSyncHostedConfig.and(
  t.object({
    _type: t.literal('cloud'),
    /** The instance name */
    name: t.string
  })
);
export type CLICloudConfig = t.Encoded<typeof CLICloudConfig>;
export type CLICloudConfigDecoded = t.Decoded<typeof CLICloudConfig>;

export const CLICloudConfigSchema = t.generateJSONSchema(CLICloudConfig, { parsers: [configFile.portParser] });
