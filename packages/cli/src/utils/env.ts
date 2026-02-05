const DEFAULT_PS_MANAGEMENT_SERVICE_URL = 'https://powersync-api.journeyapps.com';

export type ENV = {
  _PS_MANAGEMENT_SERVICE_URL: string;
  PS_TOKEN?: string;
};

export const env: ENV = {
  _PS_MANAGEMENT_SERVICE_URL: process.env._PS_MANAGEMENT_SERVICE_URL || DEFAULT_PS_MANAGEMENT_SERVICE_URL,
  PS_TOKEN: process.env.PS_TOKEN
};
