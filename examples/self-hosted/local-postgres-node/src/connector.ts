import type { PowerSyncBackendConnector } from '@powersync/node';
import { generateToken } from './auth.js';

const POWERSYNC_URL = process.env.POWERSYNC_URL ?? 'http://localhost:8080';
const USER_ID = process.env.USER_ID ?? 'demo-user';

/**
 * Backend connector that provides JWTs for PowerSync.
 * Uses the shared HS256 secret from .env to sign tokens (demo only).
 */
export class DemoConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const secret = process.env.PS_CLIENT_AUTH_KEY;
    if (!secret) {
      throw new Error('PS_CLIENT_AUTH_KEY is required. Load from .env (see README).');
    }
    const token = await generateToken({
      endpoint: POWERSYNC_URL,
      userId: USER_ID,
      secret
    });

    console.log('token', token);

    return {
      endpoint: POWERSYNC_URL,
      token
    };
  }

  async uploadData(): Promise<void> {
    // Read-only sync demo; no uploads implemented
  }
}
