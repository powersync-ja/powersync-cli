export interface BaseStorage {
  getItem(key: string): Promise<null | string>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
}

export interface StorageCapabilities {
  supportsSecureStorage: boolean;
}

export type InsecureAuthConfig = Record<string, unknown> & {
  token?: string;
};

export type InsecureStorageConfig = Record<string, unknown> & {
  auth?: InsecureAuthConfig;
};

/**
 * General storage interface.
 */
export interface StorageService {
  capabilities: StorageCapabilities;
  getInsecureConfig(): Promise<InsecureStorageConfig>;
  insecureStoragePath: string;
  secureStorage: BaseStorage;
  updateInsecureConfig(config: InsecureStorageConfig): Promise<void>;
}
