import { Flags } from '@oclif/core';
import { Document } from 'yaml';

import { fetchCloudConfig } from '../../api/cloud/fetch-cloud-config.js';
import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';

export default class FetchConfig extends CloudInstanceCommand {
  static description = 'Fetches instance config from PowerSync Cloud. Requires a linked project. Cloud only.';
  static summary = 'Fetch config from cloud (output as yaml or json).';

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

    const { linked } = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });

    const client = await this.getClient();

    const fetched = await fetchCloudConfig(client, linked).catch((error) => {
      this.error(
        `Failed to fetch config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
        { exit: 1 }
      );
    });

    if (flags.output === 'yaml') {
      this.log(new Document(fetched).toString());
      return;
    }

    this.log(JSON.stringify(fetched, null, 2));
  }
}
