import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLIConfigSchema } from '../CLIConfig.js';
import { ServiceConfigSchema } from '../ServiceConfig.js';

// todo: Import '@powersync/service-sync-rules/schema/sync_config.json' after https://github.com/powersync-ja/powersync-service/pull/824.
const syncRulesIndex = import.meta.resolve('@powersync/service-sync-rules'); // resolves to dist/index.js
const schemaFile = fileURLToPath(new URL('../schema/sync_rules.json', syncRulesIndex));
const syncConfigSchema = JSON.parse(readFileSync(schemaFile, { encoding: 'utf8' }));

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, '..', '..', 'json-schema');

mkdirSync(schemaDir, { recursive: true });

writeFileSync(join(schemaDir, 'cli-config.json'), JSON.stringify(CLIConfigSchema, null, 2));
writeFileSync(join(schemaDir, 'service-config.json'), JSON.stringify(ServiceConfigSchema, null, 2));
writeFileSync(join(schemaDir, 'sync-config.json'), JSON.stringify(syncConfigSchema, null, 2));
