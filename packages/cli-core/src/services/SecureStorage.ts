/**
 * Interface for storing and retrieving the PowerSync auth token securely.
 * Implementations are platform-specific (e.g. macOS Keychain).
 */
export interface SecureStorage {
  deleteToken(): Promise<void>;
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
}

const SERVICE_NAME = 'PowerSync CLI';
const ACCOUNT_NAME = 'auth-token';

type KeychainModule = {
  getPassword(
    options: { account: string; service: string },
    callback: (err: Error | null, password: string) => void
  ): void;
  setPassword(
    options: { account: string; service: string; password: string },
    callback: (err: Error | null) => void
  ): void;
  deletePassword(options: { account: string; service: string }, callback: (err: Error | null) => void): void;
};

let keychainPromise: Promise<KeychainModule> | null = null;

async function getKeychain(): Promise<KeychainModule> {
  if (!keychainPromise) {
    keychainPromise = import('keychain').then((m) => (m.default ?? m) as KeychainModule);
  }
  return keychainPromise;
}

/**
 * Returns the secure storage implementation for the current platform.
 * On macOS uses the system Keychain via the keychain package (lazy-loaded).
 * Other platforms: throws (not implemented yet).
 */
export function getSecureStorage(): SecureStorage {
  if (process.platform === 'darwin') {
    return createMacOSSecureStorage();
  }
  throw new Error(`Secure storage is not implemented for ${process.platform}. Login is only supported on macOS.`);
}

function createMacOSSecureStorage(): SecureStorage {
  const options = { account: ACCOUNT_NAME, service: SERVICE_NAME };

  return {
    async getToken(): Promise<string | null> {
      const keychain = await getKeychain();
      return new Promise((resolve, reject) => {
        keychain.getPassword(options, (err: Error | null, password: string) => {
          if (err) {
            if (err.message?.includes('could not be found') || (err as Error & { code?: number }).code === 44) {
              resolve(null);
              return;
            }
            reject(err);
            return;
          }
          resolve(password ?? null);
        });
      });
    },

    async setToken(token: string): Promise<void> {
      const keychain = await getKeychain();
      return new Promise((resolve, reject) => {
        keychain.setPassword({ ...options, password: token }, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },

    async deleteToken(): Promise<void> {
      const keychain = await getKeychain();
      return new Promise((resolve, reject) => {
        keychain.deletePassword(options, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
}
