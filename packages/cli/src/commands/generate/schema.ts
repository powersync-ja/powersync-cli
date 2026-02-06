import { Flags } from '@oclif/core';
import { routes } from '@powersync/management-types';
import { schemaGenerators, SqlSyncRules, StaticSchema } from '@powersync/service-sync-rules';
import { writeFileSync } from 'fs';
import { fetchCloudSyncRulesContent } from '../../api/cloud/fetch-cloud-sync-rules-content.js';
import { fetchSelfHostedSyncRulesContent } from '../../api/self-hosted/fetch-self-hosted-sync-rules-content.js';
import { createCloudClient } from '../../clients/CloudClient.js';
import { createSelfHostedClient } from '../../clients/SelfHostedClient.js';
import { CloudProject } from '../../command-types/CloudInstanceCommand.js';
import { SelfHostedProject } from '../../command-types/SelfHostedInstanceCommand.js';
import { SharedInstanceCommand } from '../../command-types/SharedInstanceCommand.js';

export default class GenerateSchema extends SharedInstanceCommand {
  static description =
    'Generate a client-side schema file from the instance database schema and sync rules. Supports multiple output types (e.g. type, dart). Requires a linked instance. Cloud and self-hosted.';
  static summary = 'Generate client schema file from instance schema and sync rules.';

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

    const project = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });

    const schemaGenerator = schemaGenerators[flags.output as keyof typeof schemaGenerators];
    if (!schemaGenerator) {
      this.error(`Invalid output type: ${flags.output}. Supported types: ${Object.keys(schemaGenerators).join(', ')}`, {
        exit: 1
      });
    }

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
    this.log(`Generated schema written to ${flags['output-path']}`);
  }
}
