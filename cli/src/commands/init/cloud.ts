import { ux } from '@oclif/core';
import {
  CLI_FILENAME,
  CommandHelpGroup,
  InstanceCommand,
  SERVICE_FILENAME,
  SYNC_FILENAME,
  YAML_SERVICE_SCHEMA
} from '@powersync/cli-core';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CLOUD_CLI_TEMPLATE_PATH,
  CLOUD_SERVICE_TEMPLATE_PATH,
  CLOUD_SYNC_CONFIG_TEMPLATE_PATH,
  CLOUD_TEMPLATES_DIR,
  writeCloudTemplateFiles
} from '../../api/cloud/create-cloud-template.js';
import { buildServiceYaml } from '../../utils/build-service-yaml.js';

export default class InitCloud extends InstanceCommand {
  static commandHelpGroup = CommandHelpGroup.PROJECT_SETUP;
  static description =
    'Copy a Cloud template into a config directory (default powersync/). Edit service.yaml then run link cloud and deploy.';
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --directory=powersync'
  ];
  static flags = {
    ...InstanceCommand.flags
  };
  static summary = 'Scaffold a PowerSync Cloud config directory from a template.';

  async run(): Promise<void> {
    const { flags } = await this.parse(InitCloud);
    const { directory } = flags;
    const targetDir = this.resolveProjectDir(flags);

    if (existsSync(targetDir)) {
      this.styledError({
        message: `Directory "${directory}" already exists. Delete the folder to start over, or link existing config to PowerSync Cloud with ${ux.colorize('blue', 'powersync link')}.`
      });
    }

    if (!existsSync(CLOUD_TEMPLATES_DIR)) {
      this.styledError({
        message: `Template not found for cloud at ${CLOUD_TEMPLATES_DIR}`
      });
    }

    mkdirSync(targetDir, { recursive: true });
    copyFileSync(CLOUD_CLI_TEMPLATE_PATH, join(targetDir, CLI_FILENAME));
    copyFileSync(CLOUD_SYNC_CONFIG_TEMPLATE_PATH, join(targetDir, SYNC_FILENAME));

    const servicePath = join(targetDir, SERVICE_FILENAME);

    const renderedServiceYaml = buildServiceYaml({
      baseConfig: {
        _type: 'cloud',
        name: 'my-cli-instance',
        region: 'us'
      },
      schemaHeader: YAML_SERVICE_SCHEMA,
      templatePath: CLOUD_SERVICE_TEMPLATE_PATH
    });

    writeFileSync(servicePath, renderedServiceYaml);

    await writeCloudTemplateFiles({ targetDir });

    const instructions = [
      'Create a new instance with ',
      ux.colorize('blue', '\tpowersync link cloud --create --org-id=<org-id> --project-id=<project-id>'),
      'or pull an existing instance with ',
      ux.colorize(
        'blue',
        '\tpowersync pull instance --org-id=<org-id> --project-id=<project-id> --instance-id=<instance-id>'
      ),
      `Tip: use ${ux.colorize('blue', 'powersync fetch instances')} to see available organizations and projects for your token.`,
      'Then run',
      ux.colorize('blue', '\tpowersync deploy'),
      'to deploy changes.'
    ].join('\n');

    const lines = [
      ux.colorize('green', 'Created PowerSync cloud project!'),
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
