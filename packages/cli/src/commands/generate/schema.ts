import { Flags } from '@oclif/core';
import { schemaGenerators, SqlSyncRules, StaticSchema } from '@powersync/service-sync-rules';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';
import { SYNC_FILENAME } from '../../utils/project-config.js';

// TODO: Add support for self-hosted instances.
export default class GenerateSchema extends CloudInstanceCommand {
  static description =
    'Generates client-side schema from instance schema and sync rules. Supported for Cloud and self-hosted.';
  static summary = 'Create client-side schemas.';

  static flags = {
    ...CloudInstanceCommand.flags,
    output: Flags.string({
      default: 'type',
      description: 'Output type: ' + Object.keys(schemaGenerators).join(', '),
      options: Object.keys(schemaGenerators),
      required: true
    }),
    'output-path': Flags.string({
      description: 'Path to output the schema file.',
      required: true
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(GenerateSchema);

    const { projectDirectory, linked } = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });

    const client = await this.getClient();

    const instanceConfig = await client.getInstanceConfig({
      app_id: linked.project_id,
      org_id: linked.org_id,
      id: linked.instance_id
    });

    const databaseSchema = await client
      .getInstanceSchema({
        app_id: linked.project_id,
        org_id: linked.org_id,
        id: linked.instance_id
      })
      .catch((error) => {
        this.error(
          `Failed to get database schema for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
          { exit: 1 }
        );
      });

    const schemaGenerator = schemaGenerators[flags.output as keyof typeof schemaGenerators];
    if (!schemaGenerator) {
      this.error(`Invalid output type: ${flags.output}. Supported types: ${Object.keys(schemaGenerators).join(', ')}`, {
        exit: 1
      });
    }

    const syncRulesPath = join(projectDirectory, SYNC_FILENAME);
    const syncRulesContent = existsSync(syncRulesPath)
      ? readFileSync(syncRulesPath, 'utf8')
      : instanceConfig.sync_rules;

    if (!syncRulesContent) {
      this.error(
        `No sync rules found. Either create a sync.yaml file in the project directory or deploy sync rules to the instance first.`,
        { exit: 1 }
      );
    }

    const staticSchema = new StaticSchema(databaseSchema.connections);
    const schema = schemaGenerator.generate(
      SqlSyncRules.fromYaml(syncRulesContent, {
        defaultSchema: databaseSchema.defaultSchema ?? 'public',
        schema: staticSchema
      }),
      staticSchema
    );

    writeFileSync(flags['output-path'], schema, 'utf8');
    this.log(`Generated schema written to ${flags.outputPath}`);
  }
}
