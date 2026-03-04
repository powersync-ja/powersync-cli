import { ux } from '@oclif/core';
import {
  CLI_FILENAME,
  InstanceCommand,
  SERVICE_FILENAME,
  SYNC_FILENAME,
  YAML_CLI_SCHEMA,
  YAML_SERVICE_SCHEMA,
  YAML_SYNC_RULES_SCHEMA
} from '@powersync/cli-core';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', '..', 'templates');

export default class InitCloud extends InstanceCommand {
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

    const templatePath = join(TEMPLATES_DIR, 'cloud', 'powersync');
    if (!existsSync(templatePath)) {
      this.styledError({
        message: `Template not found for cloud at ${templatePath}`
      });
    }

    mkdirSync(targetDir, { recursive: true });
    cpSync(templatePath, targetDir, { recursive: true });

    const servicePath = join(targetDir, SERVICE_FILENAME);
    const syncPath = join(targetDir, SYNC_FILENAME);
    const cliPath = join(targetDir, CLI_FILENAME);

    writeFileSync(servicePath, `${YAML_SERVICE_SCHEMA}\n\n${readFileSync(servicePath, 'utf8')}`);
    writeFileSync(syncPath, `${YAML_SYNC_RULES_SCHEMA}\n\n${readFileSync(syncPath, 'utf8')}`);
    writeFileSync(cliPath, `${YAML_CLI_SCHEMA}\n\n${readFileSync(cliPath, 'utf8')}`);

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
