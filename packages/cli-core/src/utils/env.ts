const DEFAULT_PS_MANAGEMENT_SERVICE_URL = 'https://powersync-api.journeyapps.com';
const DEFAULT_PS_ACCOUNTS_HUB_SERVICE_URL = 'https://accounts.journeyapps.com';
const DEFAULT_PS_DASHBOARD_URL = 'https://dashboard.powersync.com';

export type ENV = {
  _PS_ACCOUNTS_HUB_SERVICE_URL: string;
  _PS_DASHBOARD_URL: string;
  _PS_MANAGEMENT_SERVICE_URL: string;
  API_URL?: string;
  INSTANCE_ID?: string;
  ORG_ID?: string;
  PROJECT_ID?: string;
  PS_ADMIN_TOKEN?: string;
};

export const env: ENV = {
  _PS_ACCOUNTS_HUB_SERVICE_URL: process.env._PS_ACCOUNTS_HUB_SERVICE_URL || DEFAULT_PS_ACCOUNTS_HUB_SERVICE_URL,
  _PS_DASHBOARD_URL: process.env._PS_DASHBOARD_URL || DEFAULT_PS_DASHBOARD_URL,
  _PS_MANAGEMENT_SERVICE_URL: process.env._PS_MANAGEMENT_SERVICE_URL || DEFAULT_PS_MANAGEMENT_SERVICE_URL,
  API_URL: process.env.API_URL,
  INSTANCE_ID: process.env.INSTANCE_ID,
  ORG_ID: process.env.ORG_ID,
  PROJECT_ID: process.env.PROJECT_ID,
  PS_ADMIN_TOKEN: process.env.PS_ADMIN_TOKEN
};
