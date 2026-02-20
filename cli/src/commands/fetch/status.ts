import { Flags } from '@oclif/core';
import {
  CloudProject,
  createCloudClient,
  createSelfHostedClient,
  SelfHostedProject,
  SharedInstanceCommand
} from '@powersync/cli-core';
import { Document } from 'yaml';

import { DiagnosticsResponse, formatDiagnosticsHuman } from '../../api/display-status.js';

export default class FetchStatus extends SharedInstanceCommand {
  static description =
    'Fetch instance diagnostics: connection status, active and deploying sync config, replication state. Output as human-readable, JSON, or YAML. Cloud and self-hosted.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --output=json',
    '<%= config.bin %> <%= command.id %> --instance-id=<id> --project-id=<id>'
  ];
  static flags = {
    output: Flags.string({
      default: 'human',
      description: 'Output format: human-readable, json, or yaml.',
      options: ['human', 'json', 'yaml']
    }),
    ...SharedInstanceCommand.flags
  };
  static summary = 'Show instance diagnostics (connections, sync config, replication).';

  async getCloudStatus(project: CloudProject): Promise<DiagnosticsResponse> {
    const { linked } = project;
    const client = await createCloudClient();
    return client.getInstanceDiagnostics({
      app_id: linked.project_id,
      id: linked.instance_id,
      org_id: linked.org_id
    });
  }

  async getSelfHostedStatus(project: SelfHostedProject): Promise<DiagnosticsResponse> {
    const { linked } = project;
    const client = createSelfHostedClient({
      apiKey: linked.api_key,
      apiUrl: linked.api_url
    });
    return client.diagnostics({});
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(FetchStatus);

    const project = await this.loadProject(flags);

    try {
      const diagnostics = await (project.linked.type === 'cloud'
        ? this.getCloudStatus(project as CloudProject)
        : this.getSelfHostedStatus(project as SelfHostedProject));

      if (flags.output === 'json') {
        this.log(JSON.stringify(diagnostics, null, 2));
      } else if (flags.output === 'yaml') {
        this.log(new Document(diagnostics).toString());
      } else {
        this.log(formatDiagnosticsHuman(diagnostics));
      }
    } catch (error) {
      this.styledError({ error, message: 'Failed to fetch instance diagnostics' });
    }
  }
}
