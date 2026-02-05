import { Flags } from '@oclif/core';
import { CloudInstanceCommand } from '../../command-types/CloudInstanceCommand.js';

export default class GenerateToken extends CloudInstanceCommand {
  static description =
    'Generates a development token for connecting clients. Cloud and self-hosted (when shared secret is in config).';
  static summary = 'Create a client token for the PowerSync service.';

  static flags = {
    ...CloudInstanceCommand.flags,
    subject: Flags.string({
      description: 'Subject of the token.',
      required: true
    }),
    'expires-in-seconds': Flags.integer({
      description: 'Expiration time in seconds. Default is 43,200 (12 hours).',
      required: false,
      default: 43_200
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(GenerateToken);
    const { linked } = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });
    const client = await this.getClient();

    // Get the config in order to check if development tokens are enabled.
    const config = await client
      .getInstanceConfig({
        app_id: linked.project_id,
        org_id: linked.org_id,
        id: linked.instance_id
      })
      .catch((error) => {
        this.error(
          `Failed to get config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}: ${error}`,
          { exit: 1 }
        );
      });

    if (!config?.config?.client_auth?.allow_temporary_tokens) {
      this.error(
        [
          'Development tokens are not enabled for this instance.',
          'Set the following config in the instance config to enable development tokens:',
          '  client_auth:',
          '    allow_temporary_tokens: true',
          'Then deploy an update to enable development tokens first.'
        ].join('\n'),
        {
          exit: 1
        }
      );
    }

    const response = await client.generateDevToken({
      app_id: linked.project_id,
      org_id: linked.org_id,
      id: linked.instance_id,
      subject: flags.subject,
      expiresInSeconds: flags['expires-in-seconds']
    });

    // The output of this is purposefully simple in order for the output to be easily used in shell scripts.
    this.log(response.token);
  }
}
