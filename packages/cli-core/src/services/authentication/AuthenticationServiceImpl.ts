import { env } from '../../utils/env.js';
import { StorageService } from '../storage/StorageService.js';
import { AuthenticationService } from './AuthenticationService.js';

export type AuthenticationServiceImplOptions = {
  storage: StorageService;
};

const TOKEN_KEY = 'auth-token';

export class AuthenticationServiceImpl implements AuthenticationService {
  protected storage: StorageService | null;

  constructor(options: AuthenticationServiceImplOptions) {
    const storageService = options.storage;
    // Fallback to internal storage if secure storage is not supported
    if (storageService.capabilities.supportsSecureStorage) {
      this.storage = storageService;
    } else {
      this.storage = null;
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.storage) {
      return env.TOKEN || null;
    }
    return this.storage.secureStorage.getItem(TOKEN_KEY);
  }

  async setToken(token: string): Promise<void> {
    if (!this.storage) {
      throw new Error('Secure storage is not supported on this platform.');
    }
    await this.storage.secureStorage.setItem(TOKEN_KEY, token);
  }

  async deleteToken(): Promise<void> {
    if (!this.storage) {
      throw new Error('Secure storage is not supported on this platform.');
    }
    await this.storage.secureStorage.removeItem(TOKEN_KEY);
  }
}
