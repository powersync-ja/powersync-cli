import { Flags, ux } from '@oclif/core';
import {
  CloudProject,
  createCloudClient,
  createSelfHostedClient,
  SelfHostedProject,
  SharedInstanceCommand
} from '@powersync/cli-core';
import { routes } from '@powersync/management-types';
import { schemaGenerators, SqlSyncRules, StaticSchema } from '@powersync/service-sync-rules';
import { writeFileSync } from 'node:fs';

import { fetchCloudSyncRulesContent } from '../../api/cloud/fetch-cloud-sync-rules-content.js';
import { fetchSelfHostedSyncRulesContent } from '../../api/self-hosted/fetch-self-hosted-sync-rules-content.js';

export default class GenerateSchema extends SharedInstanceCommand {
  static description =
    'Generate a client-side schema file from the instance database schema and sync config. Supports multiple output types (e.g. type, dart). Requires a linked instance. Cloud and self-hosted.';
  static flags = {
    output: Flags.string({
      default: 'type',
      description: 'Output type: ' + Object.keys(schemaGenerators).join(', '),
      options: Object.keys(schemaGenerators),
      required: true
    }),
    'output-path': Flags.string({
      description: 'Path to output the schema file.',
      required: true
    }),
    ...SharedInstanceCommand.flags
  };
  static summary = 'Generate client schema file from instance schema and sync config.';

  async getCloudSchema(project: CloudProject): Promise<routes.GetSchemaResponse> {
    const { linked } = project;
    const client = await createCloudClient();
    return client.getInstanceSchema({
      app_id: linked.project_id,
      id: linked.instance_id,
      org_id: linked.org_id
    });
  }

  async getSelfHostedSchema(project: SelfHostedProject): Promise<routes.GetSchemaResponse> {
    const { linked } = project;
    const client = createSelfHostedClient({
      apiKey: linked.api_key,
      apiUrl: linked.api_url
    });
    return client.getSchema({});
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(GenerateSchema);

    const project = await this.loadProject(flags);

    const schemaGenerator = schemaGenerators[flags.output as keyof typeof schemaGenerators];
    if (!schemaGenerator) {
      this.styledError({
        message: `Invalid output type: ${flags.output}. Supported types: ${Object.keys(schemaGenerators).join(', ')}`
      });
    }

    try {
      const databaseSchema = await (project.linked.type === 'cloud'
        ? this.getCloudSchema(project as CloudProject)
        : this.getSelfHostedSchema(project as SelfHostedProject));

      const syncRulesContent = await (project.linked.type === 'cloud'
        ? fetchCloudSyncRulesContent(project as CloudProject)
        : fetchSelfHostedSyncRulesContent(project as SelfHostedProject));

      const staticSchema = new StaticSchema(databaseSchema.connections);
      const schema = schemaGenerator.generate(
        SqlSyncRules.fromYaml(syncRulesContent, {
          defaultSchema: databaseSchema.defaultSchema ?? 'public',
          schema: staticSchema
        }),
        staticSchema
      );

      writeFileSync(flags['output-path'], schema, 'utf8');
      this.log(ux.colorize('green', `Generated schema written to ${flags['output-path']}`));
    } catch (error) {
      this.styledError({ error, message: 'Failed to generate schema' });
    }
  }
}
