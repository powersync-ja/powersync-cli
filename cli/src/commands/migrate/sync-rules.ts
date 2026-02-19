import { Flags, ux } from '@oclif/core';

import { InstanceCommand, SYNC_FILENAME, YAML_SYNC_RULES_SCHEMA } from '@powersync/cli-core';
import { access, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { instantiate } from '@powersync-community/sync-config-rewriter';

import { join } from 'node:path';

export default class MigrateSyncRules extends InstanceCommand {
  static description = 'Migrates Sync Rules to Sync Streams';
  static summary = 'Migrates Sync Rules to Sync Streams';

  static flags = {
    'input-file': Flags.string({
      description: 'Path to the input sync rules file. Defaults to the project sync.yaml file.',
      required: false
    }),
    'output-file': Flags.string({
      description: 'Path to the output sync streams file. Defaults to overwrite the input file.',
      required: false
    }),
    ...InstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(MigrateSyncRules);

    const syncInputPath = flags['input-file'] ?? join(this.ensureProjectDirExists(flags), SYNC_FILENAME);
    const syncOutputPath = flags['output-file'] ?? syncInputPath;

    if (
      !(await access(syncInputPath)
        .then(() => true)
        .catch(() => false))
    ) {
      this.styledError({
        message: `Sync input file ${syncInputPath} not found.`
      });
    }
    const syncInputContent = await readFile(syncInputPath, 'utf8');

    const wasmBuffer = await readFile(
      fileURLToPath(import.meta.resolve('@powersync-community/sync-config-rewriter/compiled.wasm'))
    );

    const SyncStreamsRewriter = await instantiate(wasmBuffer);

    const output = SyncStreamsRewriter.syncRulesToSyncStreams(syncInputContent);
    switch (output.type) {
      case 'error':
        this.styledError({
          message: `Failed to migrate sync rules: ${output.diagnostics.map((d) => `${d.message} at line ${d.startOffset}, column ${d.length}`).join('\n')}`
        });
      case 'success':
        const outputContent = output.result;
        await writeFile(syncOutputPath, YAML_SYNC_RULES_SCHEMA + outputContent);
        this.log(ux.colorize('green', `Wrote ${syncOutputPath} with migrated sync streams.`));
    }
  }
}
