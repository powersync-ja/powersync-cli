export interface BaseStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface StorageCapabilities {
  supportsSecureStorage: boolean;
}

/**
 * General storage interface.
 */
export interface StorageService {
  capabilities: StorageCapabilities;
  secureStorage: BaseStorage;
  // We don't expose non-secure storage yet, but we could in the future
}
