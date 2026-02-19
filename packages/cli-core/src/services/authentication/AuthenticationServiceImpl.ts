import { StorageService } from '../storage/StorageService.js';
import { AuthenticationService } from './AuthenticationService.js';

export type AuthenticationServiceImplOptions = {
  storage: StorageService;
};

const TOKEN_KEY = 'auth-token';

export class AuthenticationServiceImpl implements AuthenticationService {
  protected storage: StorageService;

  constructor(options: AuthenticationServiceImplOptions) {
    this.storage = options.storage;
  }

  async getToken(): Promise<string | null> {
    if (this.storage.capabilities.supportsSecureStorage) {
      return this.storage.secureStorage.getItem(TOKEN_KEY);
    }

    const config = await this.storage.getInsecureConfig();
    return config.auth?.token ?? null;
  }

  async setToken(token: string): Promise<void> {
    if (this.storage.capabilities.supportsSecureStorage) {
      await this.storage.secureStorage.setItem(TOKEN_KEY, token);
      return;
    }

    const config = await this.storage.getInsecureConfig();
    config.auth = {
      ...(config.auth ?? {}),
      token
    };
    await this.storage.updateInsecureConfig(config);
  }

  async deleteToken(): Promise<void> {
    if (this.storage.capabilities.supportsSecureStorage) {
      await this.storage.secureStorage.removeItem(TOKEN_KEY);
      return;
    }

    const config = await this.storage.getInsecureConfig();
    if (!config.auth || typeof config.auth.token === 'undefined') {
      return;
    }

    delete config.auth.token;
    if (Object.keys(config.auth).length === 0) {
      delete config.auth;
    }
    await this.storage.updateInsecureConfig(config);
  }
}
