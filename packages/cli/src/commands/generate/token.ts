import { Flags } from '@oclif/core';
import * as jose from 'jose';
import { createCloudClient } from '../../clients/CloudClient.js';
import { CloudProject } from '../../command-types/CloudInstanceCommand.js';
import { SelfHostedProject } from '../../command-types/SelfHostedInstanceCommand.js';
import { SharedInstanceCommand } from '../../command-types/SharedInstanceCommand.js';

type TokenConfig = {
  subject: string;
  expiresInSeconds: number;
  kid?: string;
};

export default class GenerateToken extends SharedInstanceCommand {
  static description =
    'Generate a JWT for development clients to connect to PowerSync. Cloud: uses instance dev-token API (allow_temporary_tokens must be enabled). Self-hosted: signs with shared secret from config. Requires --subject; optional --expires-in-seconds.';
  static summary = 'Generate a development JWT for client connections.';

  static flags = {
    subject: Flags.string({
      description: 'Subject of the token.',
      required: true
    }),
    'expires-in-seconds': Flags.integer({
      description: 'Expiration time in seconds. Default is 43,200 (12 hours).',
      required: false,
      default: 43_200
    }),
    kid: Flags.string({
      description:
        '[Self-hosted only] Key ID of the key to use for signing the token. If not provided, the first key will be used.',
      required: false
    }),
    ...SharedInstanceCommand.flags
  };

  protected async generateCloudToken(project: CloudProject, config: TokenConfig): Promise<string> {
    const { linked } = project;
    const client = await createCloudClient();

    // Get the config in order to check if development tokens are enabled.
    const cloudInstanceConfig = await client
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

    if (!cloudInstanceConfig?.config?.client_auth?.allow_temporary_tokens) {
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
      subject: config.subject,
      expiresInSeconds: config.expiresInSeconds
    });
    return response.token;
  }

  protected async generateSelfHostedToken(project: SelfHostedProject, config: TokenConfig): Promise<string> {
    // For self hosted we can check if there is a shared secret in the config file and then manually create a token with JOSE
    const instanceConfig = this.parseSelfHostedConfig(project.projectDirectory);
    const usableKeys = instanceConfig.client_auth?.jwks?.keys?.filter((key) => key.alg === 'HS256') ?? [];
    if (!usableKeys.length) {
      this.error('No usable keys found in the config file. Please add a shared secret to the config file.', {
        exit: 1
      });
    }
    const specificKey = usableKeys.find((key) => key.kid === config.kid);
    if (config.kid && !specificKey) {
      this.error('No key found with the given kid.', { exit: 1 });
    }

    const key = (config.kid ? specificKey : usableKeys[0])!;

    const endpoint = project.linked.api_url;
    const audiences = [endpoint];
    instanceConfig.client_auth?.audience?.forEach((audience) => audiences.push(audience));

    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: key.alg!, kid: key.kid })
      .setSubject(config.subject)
      .setAudience(audiences)
      .setIssuer('powersync-cli')
      .setIssuedAt()
      .setExpirationTime(`${config.expiresInSeconds}s`)
      .sign(key);
    return token;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(GenerateToken);
    const project = this.loadProject(flags, {
      configFileRequired: false,
      linkingIsRequired: true
    });

    const token = await (project.linked.type === 'cloud'
      ? this.generateCloudToken(project as CloudProject, {
          subject: flags.subject,
          expiresInSeconds: flags['expires-in-seconds']
        })
      : this.generateSelfHostedToken(project as SelfHostedProject, {
          subject: flags.subject,
          expiresInSeconds: flags['expires-in-seconds'],
          kid: flags['kid']
        }));

    // This is purposefully simple in order for the output to be easily used in shell scripts.
    this.log(token);
  }
}
