const DEFAULT_PS_MANAGEMENT_SERVICE_URL = 'https://powersync-api.journeyapps.com';

export type ENV = {
  _PS_MANAGEMENT_SERVICE_URL: string;
  PS_TOKEN?: string;
  INSTANCE_ID?: string;
  ORG_ID?: string;
  PROJECT_ID?: string;
  API_URL?: string;
};

export const env: ENV = {
  _PS_MANAGEMENT_SERVICE_URL: process.env._PS_MANAGEMENT_SERVICE_URL || DEFAULT_PS_MANAGEMENT_SERVICE_URL,
  PS_TOKEN: process.env.PS_TOKEN,
  INSTANCE_ID: process.env.INSTANCE_ID,
  ORG_ID: process.env.ORG_ID,
  PROJECT_ID: process.env.PROJECT_ID,
  API_URL: process.env.API_URL
};
