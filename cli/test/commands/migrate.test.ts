import { runCommand } from '@oclif/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, onTestFinished, test } from 'vitest';

import { root } from '../helpers/root.js';

test('migrates from sync rules to sync streams', async () => {
  const testDirectory = mkdtempSync(join(tmpdir(), 'migrate-test-'));
  onTestFinished(() => rmSync(testDirectory, { recursive: true }));

  const inputFile = join(testDirectory, 'input.yaml');
  const outputFile = join(testDirectory, 'output.yaml');
  writeFileSync(
    inputFile,
    `
bucket_definitions:
  user_lists:
    parameters: SELECT request.user_id() as user_id 
    data:
      - SELECT * FROM lists WHERE owner_id = bucket.user_id   
`
  );

  const result = await runCommand(`migrate sync-rules --input-file ${inputFile} --output-file ${outputFile}`, { root });
  expect(result.error).toBeUndefined();

  const transformed = readFileSync(outputFile).toString('utf-8');
  expect(transformed)
    .toStrictEqual(`# Adds YAML Schema support for VSCode users with the YAML extension installed. This enables features like validation and autocompletion based on the provided schema.
# yaml-language-server: $schema=https://unpkg.com/@powersync/service-sync-rules@latest/schema/sync_rules.json
config:
  edition: 3
streams:
  # This Sync Stream has been translated from bucket definitions. There may be more efficient ways to express these queries.
  # You can add additional queries to this list if you need them.
  # For details, see the documentation: https://docs.powersync.com/sync/streams/overview
  migrated_to_streams:
    auto_subscribe: true
    queries:
      - SELECT * FROM lists WHERE owner_id = auth.user_id()
`);
});
