export interface BaseStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface StorageCapabilities {
  supportsSecureStorage: boolean;
}

export type InsecureAuthConfig = {
  token?: string;
} & Record<string, unknown>;

export type InsecureStorageConfig = {
  auth?: InsecureAuthConfig;
} & Record<string, unknown>;

/**
 * General storage interface.
 */
export interface StorageService {
  capabilities: StorageCapabilities;
  secureStorage: BaseStorage;
  insecureStoragePath: string;
  getInsecureConfig(): Promise<InsecureStorageConfig>;
  updateInsecureConfig(config: InsecureStorageConfig): Promise<void>;
}
