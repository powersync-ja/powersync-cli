import { createKeychainSecureStorage } from './KeychainSecureStorage.js';
import { BaseStorage, StorageCapabilities, StorageService } from './StorageService.js';

export class InternalStorage implements BaseStorage {
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(localStorage.getItem(key));
  }
  setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
    return Promise.resolve();
  }
  removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
    return Promise.resolve();
  }
}

export const StubSecureStorage: BaseStorage = {
  getItem: () => Promise.reject(new Error('Secure storage is not supported')),
  setItem: () => Promise.reject(new Error('Secure storage is not supported')),
  removeItem: () => Promise.reject(new Error('Secure storage is not supported'))
};

export class StorageImpl implements StorageService {
  protected _secureStorage: BaseStorage | null;

  get capabilities(): StorageCapabilities {
    return {
      supportsSecureStorage: this._secureStorage !== null
    };
  }

  get secureStorage(): BaseStorage {
    return this._secureStorage ?? StubSecureStorage;
  }

  constructor() {
    // Secure storage is only supported on macOS for now
    if (process.platform === 'darwin') {
      this._secureStorage = createKeychainSecureStorage();
    } else {
      this._secureStorage = null;
    }
  }
}
