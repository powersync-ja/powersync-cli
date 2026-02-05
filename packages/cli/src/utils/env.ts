const DEFAULT_PS_MANAGEMENT_SERVICE_URL = 'https://powersync-api.journeyapps.com';

export type ENV = {
  _PS_MANAGEMENT_SERVICE_URL: string;
  PS_TOKEN?: string;

  /**
   * Environment variables for manually providing the instance ID, org ID, and project ID.
   * This can be useful for quickly performing an operation on a specific instance.
   * The order of precedence is:
   * 1. Flags passed to the command
   * 2. Link.yaml file
   * 3. Environment variables
   */
  INSTANCE_ID?: string;
  ORG_ID?: string;
  PROJECT_ID?: string;
};

export const env: ENV = {
  _PS_MANAGEMENT_SERVICE_URL: process.env._PS_MANAGEMENT_SERVICE_URL || DEFAULT_PS_MANAGEMENT_SERVICE_URL,
  PS_TOKEN: process.env.PS_TOKEN,
  INSTANCE_ID: process.env.INSTANCE_ID,
  ORG_ID: process.env.ORG_ID,
  PROJECT_ID: process.env.PROJECT_ID
};
