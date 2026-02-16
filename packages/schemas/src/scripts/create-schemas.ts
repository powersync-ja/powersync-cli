import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIConfigSchema } from '../CLIConfig.js';
import { ServiceConfigSchema } from '../ServiceConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, '..', '..', 'json-schema');

mkdirSync(schemaDir, { recursive: true });

writeFileSync(join(schemaDir, 'cli-config.json'), JSON.stringify(CLIConfigSchema, null, 2));
writeFileSync(join(schemaDir, 'service-config.json'), JSON.stringify(ServiceConfigSchema, null, 2));
