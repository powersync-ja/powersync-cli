import { Flags } from '@oclif/core';
import {
  CloudProject,
  createCloudClient,
  SelfHostedProject,
  SERVICE_FILENAME,
  SharedInstanceCommand
} from '@powersync/cli-core';
import { ServiceSelfHostedConfig } from '@powersync/cli-schemas';
import * as jose from 'jose';
import { join } from 'node:path';

type TokenConfig = {
  expiresInSeconds: number;
  kid?: string;
  subject: string;
};

export default class GenerateToken extends SharedInstanceCommand {
  static description =
    'Generate a JWT for development clients to connect to PowerSync. Cloud: uses instance dev-token API (allow_temporary_tokens must be enabled). Self-hosted: signs with shared secret from config. Requires --subject; optional --expires-in-seconds.';
  static examples = [
    '<%= config.bin %> <%= command.id %> --subject=user-123',
    '<%= config.bin %> <%= command.id %> --subject=user-123 --expires-in-seconds=3600'
  ];
  static flags = {
    'expires-in-seconds': Flags.integer({
      default: 43_200,
      description: 'Expiration time in seconds. Default is 43,200 (12 hours).',
      required: false
    }),
    kid: Flags.string({
      description:
        '[Self-hosted only] Key ID of the key to use for signing the token. If not provided, the first key will be used.',
      required: false
    }),
    subject: Flags.string({
      description: 'Subject of the token.',
      required: true
    })
  };
  static summary = 'Generate a development JWT for client connections.';

  protected async generateCloudToken(project: CloudProject, config: TokenConfig): Promise<string> {
    const { linked } = project;
    const client = createCloudClient();

    // Get the config in order to check if development tokens are enabled.
    const cloudInstanceConfig = await client
      .getInstanceConfig({
        app_id: linked.project_id,
        id: linked.instance_id,
        org_id: linked.org_id
      })
      .catch((error) => {
        this.styledError({
          error,
          message: `Failed to get config for instance ${linked.instance_id} in project ${linked.project_id} in org ${linked.org_id}`
        });
      });

    if (!cloudInstanceConfig?.config?.client_auth?.allow_temporary_tokens) {
      this.styledError({
        message:
          'Development tokens are not enabled for this instance. Set the following config in the instance config to enable development tokens:\n  client_auth:\n    allow_temporary_tokens: true\nThen deploy an update to enable development tokens first.'
      });
    }

    const response = await client.generateDevToken({
      app_id: linked.project_id,
      expiresInSeconds: config.expiresInSeconds,
      id: linked.instance_id,
      org_id: linked.org_id,
      subject: config.subject
    });
    return response.token;
  }

  protected async generateSelfHostedToken(project: SelfHostedProject, config: TokenConfig): Promise<string> {
    // For self hosted we can check if there is a shared secret in the config file and then manually create a token with JOSE
    let instanceConfig: ServiceSelfHostedConfig;
    try {
      instanceConfig = this.parseSelfHostedConfig(project.projectDirectory);
    } catch (error) {
      this.styledError({
        error,
        message: 'Generating a token for self hosted instances requires the configuration to be locally present.',
        suggestions: [`Ensure that ${join(project.projectDirectory, SERVICE_FILENAME)} exists`]
      });
    }

    const usableKeys = instanceConfig.client_auth?.jwks?.keys?.filter((key) => key.alg === 'HS256') ?? [];
    if (usableKeys.length === 0) {
      this.styledError({
        message: [
          `No usable keys found in the config file.`,
          `Please add a shared secret to the config file.`,
          `Secrets should be added to the client_auth->jwks->keys array in the config file, for example:`,
          `client_auth:`,
          `  jwks:`,
          `    keys:`,
          `      - kty: oct`,
          `        alg: HS256`,
          `        kid: my-key-id`,
          `        k: base64-encoded-secret-here`
        ].join('\n')
      });
    }

    const specificKey = usableKeys.find((key) => key.kid === config.kid);
    if (config.kid && !specificKey) {
      this.styledError({ message: 'No key found with the given kid.' });
    }

    const key = (config.kid ? specificKey : usableKeys[0])!;

    const endpoint = project.linked.api_url;
    const audiences = [endpoint];
    for (const aud of instanceConfig.client_auth?.audience ?? []) {
      audiences.push(aud);
    }

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
    const project = await this.loadProject(flags);

    const token = await (project.linked.type === 'cloud'
      ? this.generateCloudToken(project as CloudProject, {
          expiresInSeconds: flags['expires-in-seconds'],
          subject: flags.subject
        })
      : this.generateSelfHostedToken(project as SelfHostedProject, {
          expiresInSeconds: flags['expires-in-seconds'],
          kid: flags.kid,
          subject: flags.subject
        }));

    // This is purposefully simple in order for the output to be easily used in shell scripts.
    this.log(token);
  }
}
