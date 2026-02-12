/**
 * TODO, replace this with a new public accounts SDK in future
 */

/**
 * @fileoverview API client for AccountsHub service
 * @module lib/api/clients/AccountsHubClient
 */

import * as sdk from '@journeyapps-labs/common-sdk';
import { ux } from '@oclif/core';
import { getSecureStorage } from '../services/SecureStorage.js';
import { env } from '../utils/env.js';

/**
 * Client for interacting with the AccountsHub API service.
 *
 * Handles:
 * - User authentication and profile management
 * - Organization management
 * - Project listing
 * - User management within organizations
 */

export type Org = {
  id: string;
  label: string;
};

export type Project = {
  id: string;
  name: string;
};

export class AccountsHubClientSDKClient<C extends sdk.NetworkClient = sdk.NetworkClient> extends sdk.SDKClient<C> {
  getOrganization = this.createEndpoint<{ id: string }, Org>({
    path: '/api/accounts/v5/organizations/get',
    method: 'post'
  });

  listOrganizations = sdk.createPaginatedEndpoint(
    this.createEndpoint<sdk.PaginationParams & { id?: string }, sdk.PaginationResponse & { objects: Org[] }>({
      path: '/api/accounts/v5/organizations/list',
      method: 'post'
    })
  );

  listProjects = sdk.createPaginatedEndpoint(
    this.createEndpoint<
      sdk.PaginationParams & { org_id?: string; id?: string },
      sdk.PaginationResponse & { objects: Project[] }
    >({
      path: '/api/accounts/v5/apps/list',
      method: 'post'
    })
  );
}

/**
 * Creates a PowerSync Accounts Hub Client for the Cloud.
 * Uses the token stored by the login command (secure storage, e.g. macOS Keychain).
 */
export async function createAccountsHubClient(): Promise<AccountsHubClientSDKClient> {
  const storage = getSecureStorage();
  const token = env.TOKEN || (await storage.getToken());
  if (!token) {
    throw new Error(
      `Not logged in. Run ${ux.colorize('blue', 'powersync login')} to authenticate (you will be prompted for your token). Login is supported on macOS (other platforms coming soon).`
    );
  }
  return new AccountsHubClientSDKClient({
    client: sdk.createWebNetworkClient({
      headers: () => ({
        Authorization: `Bearer ${token}`
      })
    }),
    endpoint: env._PS_ACCOUNTS_HUB_SERVICE_URL
  });
}
