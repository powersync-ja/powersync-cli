/**
 * TODO, replace this with a new public accounts SDK in future
 */

/**
 * @fileoverview API client for AccountsHub service
 * @module lib/api/clients/AccountsHubClient
 */

import * as sdk from '@journeyapps-labs/common-sdk';
import { ux } from '@oclif/core';
import { Services } from '../services/services.js';
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
  const { authentication } = Services;
  const token = env.TOKEN || (await authentication.getToken());
  if (!token) {
    throw new Error(
      `Not logged in. Run ${ux.colorize('blue', 'powersync login')} to authenticate (you will be prompted for your token), or provide the ${ux.colorize('blue', 'TOKEN')} environment variable.`
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

/**
 * Resolve the default org ID when the token has access to exactly one organization.
 * Use when --org-id / ORG_ID are not set; most PAT tokens are associated with a single org.
 * Fetches organizations once and uses the result (no pagination).
 * @returns The single org's ID.
 * @throws If the token has zero or multiple orgs (caller should ask the user to pass --org-id).
 */
export async function getDefaultOrgId(): Promise<string> {
  const client = await createAccountsHubClient();
  const { objects: organizations, total } = await client.listOrganizations({});
  if (total === 0) {
    throw new Error(
      'No organizations found for the current token. Pass --org-id explicitly or use a token that has access to an organization.'
    );
  }
  if (total > 1) {
    throw new Error(
      `Token has access to multiple organizations (${total}). Pass ${ux.colorize('blue', '--org-id')} to specify which one.`
    );
  }
  return organizations[0].id;
}
