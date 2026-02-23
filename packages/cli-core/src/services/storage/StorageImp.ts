import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as yaml from 'yaml';
import { createKeychainSecureStorage } from './KeychainSecureStorage.js';
import { BaseStorage, InsecureStorageConfig, StorageCapabilities, StorageService } from './StorageService.js';

export const StubSecureStorage: BaseStorage = {
  getItem: () => Promise.reject(new Error('Secure storage is not supported')),
  setItem: () => Promise.reject(new Error('Secure storage is not supported')),
  removeItem: () => Promise.reject(new Error('Secure storage is not supported'))
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidInsecureConfig(config: unknown): config is InsecureStorageConfig {
  if (!isObjectRecord(config)) {
    return false;
  }

  if (typeof config.auth === 'undefined') {
    return true;
  }

  if (!isObjectRecord(config.auth)) {
    return false;
  }

  if (typeof config.auth.token !== 'undefined' && typeof config.auth.token !== 'string') {
    return false;
  }

  return true;
}

export class ConfigFileStorage {
  constructor(private readonly configPath: string) {}

  async getConfig(): Promise<InsecureStorageConfig> {
    try {
      const contents = await readFile(this.configPath, 'utf8');
      const parsed = yaml.parse(contents);

      if (!isValidInsecureConfig(parsed)) {
        throw new Error(`Invalid config file shape at ${this.configPath}`);
      }

      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  async updateConfig(config: InsecureStorageConfig): Promise<void> {
    if (!isValidInsecureConfig(config)) {
      throw new Error(`Invalid config file shape at ${this.configPath}`);
    }

    if (Object.keys(config).length === 0) {
      await rm(this.configPath, { force: true });
      return;
    }

    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, yaml.stringify(config), 'utf8');
  }
}

export class StorageImpl implements StorageService {
  protected _secureStorage: BaseStorage | null;
  protected _configStorage: ConfigFileStorage;

  readonly insecureStoragePath = join(
    process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
    'powersync',
    'config.yaml'
  );

  get capabilities(): StorageCapabilities {
    return {
      supportsSecureStorage: this._secureStorage !== null
    };
  }

  get secureStorage(): BaseStorage {
    return this._secureStorage ?? StubSecureStorage;
  }

  async getInsecureConfig(): Promise<InsecureStorageConfig> {
    return this._configStorage.getConfig();
  }

  async updateInsecureConfig(config: InsecureStorageConfig): Promise<void> {
    await this._configStorage.updateConfig(config);
  }

  constructor() {
    this._configStorage = new ConfigFileStorage(this.insecureStoragePath);

    // Secure storage is only supported on macOS for now
    if (process.platform === 'darwin') {
      this._secureStorage = createKeychainSecureStorage();
    } else {
      this._secureStorage = null;
    }
  }
}
