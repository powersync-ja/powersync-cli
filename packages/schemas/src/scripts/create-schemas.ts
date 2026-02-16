import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as t from 'ts-codec';
import { CLIConfigSchema } from '../CLIConfig.js';
import { LinkConfig } from '../LinkConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, '..', '..', 'json-schema');

mkdirSync(schemaDir, { recursive: true });

const linkConfigSchema = t.generateJSONSchema(LinkConfig);

writeFileSync(join(schemaDir, 'link-config.json'), JSON.stringify(linkConfigSchema, null, 2));
writeFileSync(join(schemaDir, 'cli-config.json'), JSON.stringify(CLIConfigSchema, null, 2));
