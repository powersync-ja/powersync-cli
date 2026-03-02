import { BaseStorage } from './StorageService.js';

/**
 * Interface for storing and retrieving the PowerSync auth token securely.
 * Implementations are platform-specific (e.g. macOS Keychain).
 */
const SERVICE_NAME = 'PowerSync CLI';

export function createKeychainSecureStorage(): BaseStorage {
  const keychainPromise = import('keychain').then((m) => m.default ?? m);
  return {
    async getItem(key: string): Promise<null | string> {
      const keychain = await keychainPromise;
      return new Promise((resolve, reject) => {
        keychain.getPassword(
          {
            account: key,
            service: SERVICE_NAME
          },
          (err: Error | null, password: string) => {
            if (err) {
              if (
                err.message?.includes('could not be found') ||
                (err as Error & { code?: string }).code === 'PasswordNotFound'
              ) {
                resolve(null);
                return;
              }

              reject(err);
              return;
            }

            resolve(password ?? null);
          }
        );
      });
    },

    async removeItem(key: string): Promise<void> {
      const keychain = await keychainPromise;
      return new Promise((resolve, reject) => {
        keychain.deletePassword({ account: key, service: SERVICE_NAME }, (err: Error | null) => {
          if (err) {
            if (
              err.message?.includes('could not be found') ||
              (err as Error & { code?: string }).code === 'PasswordNotFound'
            ) {
              resolve();
              return;
            }

            reject(err);
            return;
          }

          resolve();
        });
      });
    },

    async setItem(key: string, value: string): Promise<void> {
      const keychain = await keychainPromise;
      return new Promise((resolve, reject) => {
        keychain.setPassword({ account: key, password: value, service: SERVICE_NAME }, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
}
