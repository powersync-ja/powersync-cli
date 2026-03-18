import * as managementTypes from '@powersync/management-types';
import { configFile } from '@powersync/service-types';
import * as t from 'ts-codec';

export const AdditionalCloudConfigFields = t.object({
  /** Discriminator for Cloud config. */
  _type: t.literal('cloud'),
  /** Instance display name. */
  name: t.string
});
export type AdditionalCloudConfigFields = t.Encoded<typeof AdditionalCloudConfigFields>;
export type BasePowerSyncHostedConfigDecoded = managementTypes.BasePowerSyncHostedConfigDecoded;

export const ServiceCloudConfig = managementTypes.BasePowerSyncHostedConfig.and(AdditionalCloudConfigFields);
export type ServiceCloudConfig = t.Encoded<typeof ServiceCloudConfig>;
export type ServiceCloudConfigDecoded = t.Decoded<typeof ServiceCloudConfig>;

export const ServiceCloudConfigSchema = t.generateJSONSchema(ServiceCloudConfig, { parsers: [configFile.portParser] });
