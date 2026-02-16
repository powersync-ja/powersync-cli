import * as t from 'ts-codec';

import { BasePowerSyncHostedConfig } from '@powersync/management-types';
import { configFile } from '@powersync/service-types';

export const ServiceCloudConfig = BasePowerSyncHostedConfig.and(
  t.object({
    _type: t.literal('cloud'),
    /** The instance name */
    name: t.string
  })
);
export type ServiceCloudConfig = t.Encoded<typeof ServiceCloudConfig>;
export type ServiceCloudConfigDecoded = t.Decoded<typeof ServiceCloudConfig>;

export const ServiceCloudConfigSchema = t.generateJSONSchema(ServiceCloudConfig, { parsers: [configFile.portParser] });
