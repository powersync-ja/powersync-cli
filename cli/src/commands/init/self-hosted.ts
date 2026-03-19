import { ux } from '@oclif/core';
import {
  CLI_FILENAME,
  CommandHelpGroup,
  InstanceCommand,
  SERVICE_FILENAME,
  SYNC_FILENAME,
  YAML_CLI_SCHEMA,
  YAML_SERVICE_SCHEMA,
  YAML_SYNC_RULES_SCHEMA
} from '@powersync/cli-core';
import { BaseServiceSelfHostedConfig } from '@powersync/cli-schemas';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildServiceYaml } from '../../api/build-service-yaml.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'templates');

export default class InitSelfHosted extends InstanceCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description =
    'Copy a self-hosted template into a config directory (default powersync/). Configure service.yaml with your self-hosted instance details.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --directory=powersync'
  ];
  static summary = 'Scaffold a PowerSync self-hosted config directory from a template.';

  async run(): Promise<void> {
    const { flags } = await this.parse(InitSelfHosted);
    const { directory } = flags;
    const targetDir = this.resolveProjectDir(flags);

    if (existsSync(targetDir)) {
      this.styledError({
        message: `Directory "${directory}" already exists. Delete the folder to start over, or link existing config with ${ux.colorize('blue', 'powersync link self-hosted')}.`
      });
    }

    const templatePath = join(TEMPLATES_DIR, 'self-hosted', 'base', 'powersync');
    if (!existsSync(templatePath)) {
      this.styledError({
        message: `Template not found for self-hosted at ${templatePath}`
      });
    }

    mkdirSync(targetDir, { recursive: true });
    copyFileSync(join(templatePath, CLI_FILENAME), join(targetDir, CLI_FILENAME));
    copyFileSync(join(templatePath, SYNC_FILENAME), join(targetDir, SYNC_FILENAME));

    const servicePath = join(targetDir, SERVICE_FILENAME);
    const syncPath = join(targetDir, SYNC_FILENAME);
    const cliPath = join(targetDir, CLI_FILENAME);

    const serviceTemplatePath = join(templatePath, 'service.template.yaml');
    const renderedServiceYaml = buildServiceYaml({
      baseConfig: {
        _type: 'self-hosted',
        api: {
          tokens: ['use_a_better_token_in_production']
        },
        replication: {
          connections: []
        },
        // This is just used as a placeholder
        storage: {} as BaseServiceSelfHostedConfig['storage'],
        sync_config: {
          path: 'sync-config.yaml'
        },
        telemetry: {
          disable_telemetry_sharing: false
        }
      },
      schemaHeader: YAML_SERVICE_SCHEMA,
      templatePath: serviceTemplatePath,
      templateReplacementPaths: [['storage']]
    });

    writeFileSync(servicePath, renderedServiceYaml);
    writeFileSync(syncPath, `${YAML_SYNC_RULES_SCHEMA}\n\n${readFileSync(syncPath, 'utf8')}`);
    writeFileSync(cliPath, `${YAML_CLI_SCHEMA}\n\n${readFileSync(cliPath, 'utf8')}`);

    const instructions = [
      'Self Hosted projects currently require external configuration for starting and deploying.',
      `Configure the ${SERVICE_FILENAME} file with your self-hosted instance details.`,
      `See the Docker topic, with ${ux.colorize('blue', 'powersync docker --help')} for local development services.`,
      'Please refer to the PowerSync Self-Hosted documentation for more information.'
    ].join('\n');

    const lines = [
      ux.colorize('green', 'Created PowerSync self-hosted project!'),
      '',
      'Configuration files are located in:',
      `\t${targetDir}`,
      `Check the ${SERVICE_FILENAME} and ${SYNC_FILENAME} file(s) and configure them by uncommenting the options you would like to use.`,
      `Tip: Run ${ux.colorize('blue', 'powersync configure ide')} to configure your IDE for YAML schema support.`,
      '',
      instructions
    ];

    this.log(lines.join('\n'));
  }
}
