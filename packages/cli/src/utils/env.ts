const DEFAULT_PS_MANAGEMENT_SERVICE_URL = 'https://api.powersync.com';

export type ENV = {
  _PS_MANAGEMENT_SERVICE_URL: string;
};

export const env: ENV = {
  _PS_MANAGEMENT_SERVICE_URL: process.env._PS_MANAGEMENT_SERVICE_URL || DEFAULT_PS_MANAGEMENT_SERVICE_URL
};
