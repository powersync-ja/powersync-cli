import { Flags } from '@oclif/core';
import { CloudInstanceCommand } from '@powersync/cli-core';
import { Document } from 'yaml';

import { fetchCloudConfig } from '../../api/cloud/fetch-cloud-config.js';

export default class FetchConfig extends CloudInstanceCommand {
  static description = 'Retrieve the current instance config from PowerSync Cloud and print as YAML or JSON.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --output=json'
  ];
  static flags = {
    output: Flags.string({
      default: 'yaml',
      description: 'Output format: yaml or json.',
      options: ['json', 'yaml']
    }),
    ...CloudInstanceCommand.flags
  };
  static summary = '[Cloud only] Print linked Cloud instance config (YAML or JSON).';

  async run(): Promise<void> {
    const { flags } = await this.parse(FetchConfig);

    const { linked } = await this.loadProject(flags);

    const { client } = this;

    const fetched = await fetchCloudConfig(client, linked).catch((error) => {
      this.styledError({
        error,
        message: `Failed to fetch config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`
      });
    });

    if (flags.output === 'yaml') {
      this.log(new Document(fetched).toString());
      return;
    }

    this.log(JSON.stringify(fetched, null, 2));
  }
}
