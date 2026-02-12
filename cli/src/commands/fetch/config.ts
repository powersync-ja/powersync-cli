import { Flags, ux } from '@oclif/core';
import { Document } from 'yaml';

import { CloudInstanceCommand } from '@powersync/cli-core';
import { fetchCloudConfig } from '../../api/cloud/fetch-cloud-config.js';

export default class FetchConfig extends CloudInstanceCommand {
  static description =
    'Retrieve the current instance config from PowerSync Cloud and print as YAML or JSON. Cloud only.';
  static summary = 'Print linked Cloud instance config (YAML or JSON).';

  static flags = {
    output: Flags.string({
      default: 'yaml',
      description: 'Output format: yaml or json.',
      options: ['json', 'yaml']
    }),
    ...CloudInstanceCommand.flags
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FetchConfig);

    const { linked } = this.loadProject(flags);

    const client = await this.getClient();

    const fetched = await fetchCloudConfig(client, linked).catch((error) => {
      this.styledError({
        message: `Failed to fetch config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`,
        error
      });
    });

    if (flags.output === 'yaml') {
      this.log(ux.colorize('gray', new Document(fetched).toString()));
      return;
    }

    this.log(ux.colorize('gray', JSON.stringify(fetched, null, 2)));
  }
}
