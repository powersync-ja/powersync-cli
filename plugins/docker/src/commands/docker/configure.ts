import { confirm, select } from '@inquirer/prompts';
import { Flags, ux } from '@oclif/core';
import {
  CLI_FILENAME,
  ensureServiceTypeMatches,
  parseYamlDocumentPreserveTags,
  type SelfHostedInstanceCommandFlags,
  SERVICE_FILENAME,
  ServiceType
} from '@powersync/cli-core';
import fs, { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, isMap, Scalar, stringify } from 'yaml';

import { addServiceToken } from '../../add-service-token.js';
import { DEV_TOKEN } from '../../constants.js';
import { enableStackDashboard } from '../../dashboard/enable-stack-dashboard.js';
import { DockerCommand } from '../../DockerCommand.js';
import { TEMPLATES } from '../../templates/templates-index.js';
import { DockerModuleContext, DockerModuleType } from '../../types.js';

const NONE_OPTION = 'none';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_COMPOSE_TEMPLATE_PATH = path.join(__dirname, '../../templates/main-compose.yaml');
const DOCKER_DEV_API_URL = 'http://localhost:8080';

/**
 * Docker Compose project name: [a-z0-9][a-z0-9_.-]*. Derived from the project directory name.
 */
function composeProjectName(projectDirectory: string): string {
  // The project name is the directory name of the parent directory.
  const raw = path.basename(path.resolve(projectDirectory, '../'));
  const sanitized = raw
    .toLowerCase()
    .replaceAll(/[^a-z0-9_.-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');
  return `powersync_${sanitized}`;
}

async function shouldConfigureDashboard(enabled: boolean | undefined): Promise<boolean> {
  if (enabled || !process.stdin.isTTY) return Boolean(enabled);
  return confirm({ default: false, message: 'Also configure the self-hosted dashboard for this stack?' });
}

export default class DockerConfigure extends DockerCommand {
  static description = [
    'Configures a self hosted project with Docker Compose services.',
    'Docker configuration is located in ./powersync/docker/.',
    'Configured projects can be started with "powersync docker start".'
  ].join('\n');
  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --database=postgres --storage=postgres'
  ];
  static flags = {
    dashboard: Flags.boolean({ description: 'Enable the dashboard in a new or existing Docker stack.' }),
    database: Flags.string({
      description: 'Database module for replication source. Omit to be prompted.',
      options: [...TEMPLATES[DockerModuleType.SOURCE_DATABASE].map((t) => t.name), NONE_OPTION],
      required: false
    }),
    storage: Flags.string({
      description: 'Storage module for PowerSync bucket metadata. Omit to be prompted.',
      options: [...TEMPLATES[DockerModuleType.STORAGE].map((t) => t.name), NONE_OPTION],
      required: false
    })
  };
  static summary = 'Configures a self hosted project with Docker Compose services.';

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerConfigure);
    const projectDirectory = this.ensureProjectDirectory(flags as SelfHostedInstanceCommandFlags);

    const targetDockerDir = path.join(projectDirectory, 'docker');
    const modulesDir = path.join(targetDockerDir, 'modules');
    const dockerEnvFilePath = path.join(targetDockerDir, '.env');

    if (existsSync(targetDockerDir)) return this.configureExistingStack(projectDirectory, flags);

    const databaseChoices = [
      ...TEMPLATES[DockerModuleType.SOURCE_DATABASE].map((t) => ({ name: t.name, value: t.name })),
      { name: 'None (do not configure)', value: NONE_OPTION }
    ];
    const storageChoices = [
      ...TEMPLATES[DockerModuleType.STORAGE].map((t) => ({ name: t.name, value: t.name })),
      { name: 'None (do not configure)', value: NONE_OPTION }
    ];

    let { database } = flags;
    if (database === undefined) {
      database = await select({
        choices: databaseChoices,
        message: 'Select a database module for a replication source. Use external to configure an existing database.'
      });
    }

    if (database === NONE_OPTION) database = undefined;

    let { storage } = flags;
    if (storage === undefined) {
      storage = await select({
        choices: storageChoices,
        message:
          'Select a storage module for PowerSync bucket metadata. Use external to configure an existing database.'
      });
    }

    if (storage === NONE_OPTION) storage = undefined;

    const dashboard = await shouldConfigureDashboard(flags.dashboard);
    if (dashboard) {
      ensureServiceTypeMatches({
        command: this,
        configRequired: true,
        directoryLabel: flags.directory,
        expectedType: ServiceType.SELF_HOSTED,
        projectDir: projectDirectory
      });
    }

    mkdirSync(targetDockerDir, { recursive: true });
    mkdirSync(modulesDir, { recursive: true });

    const serviceConfigDocument = parseYamlDocumentPreserveTags(
      fs.readFileSync(path.join(projectDirectory, SERVICE_FILENAME), 'utf8')
    );

    const mainComposeDocument = parseYamlDocumentPreserveTags(readFileSync(MAIN_COMPOSE_TEMPLATE_PATH, 'utf8'));

    const moduleContext: DockerModuleContext = {
      command: this,
      composeOutputDirectory: targetDockerDir,
      mainComposeDocument,
      modulesOutputDirectory: modulesDir,
      projectDirectory,
      serviceConfig: serviceConfigDocument
    };

    // Starting from scratch every time
    let envFileContents = '';

    if (database) {
      const databaseTemplate = TEMPLATES[DockerModuleType.SOURCE_DATABASE].find(
        (template) => template.type === DockerModuleType.SOURCE_DATABASE && template.name === database
      );
      if (!databaseTemplate) {
        this.error(ux.colorize('red', `Database template ${database} not found.`), { exit: 1 });
      }

      const databaseModuleResponse = await databaseTemplate.apply(moduleContext);

      envFileContents += [
        `# ${databaseTemplate.name} Database Config`,
        ...Object.entries(databaseModuleResponse.additionalEnvironment ?? {}).map(([key, value]) => `${key}=${value}`)
      ].join('\n');
    }

    if (storage) {
      const storageTemplate = TEMPLATES[DockerModuleType.STORAGE].find(
        (template) => template.type === DockerModuleType.STORAGE && template.name === storage
      );
      if (!storageTemplate) {
        this.error(`Storage template ${storage} not found.`, { exit: 1 });
      }

      const storageModuleResponse = await storageTemplate.apply(moduleContext);

      envFileContents +=
        (envFileContents ? '\n\n' : '') +
        [
          `# ${storageTemplate.name} Storage Config`,
          ...Object.entries(storageModuleResponse.additionalEnvironment ?? {}).map(([key, value]) => `${key}=${value}`)
        ].join('\n');
    }

    const projectName = composeProjectName(projectDirectory);
    mainComposeDocument.set('name', projectName);
    writeFileSync(path.join(targetDockerDir, 'docker-compose.yaml'), stringify(mainComposeDocument), 'utf8');

    // Persist environment config
    writeFileSync(dockerEnvFilePath, envFileContents, 'utf8');

    // Set api.tokens in service.yaml for local dev (same token as in link) without clobbering existing settings.
    addServiceToken(serviceConfigDocument, new Scalar(DEV_TOKEN));

    writeFileSync(path.join(projectDirectory, SERVICE_FILENAME), stringify(serviceConfigDocument), 'utf8');
    updateLinkPluginsDocker(projectDirectory, projectName);
    if (dashboard) {
      this.enableDashboard(projectDirectory);
    }

    this.log(ux.colorize('green', `Configured ${targetDockerDir}`));
    this.log(ux.colorize('gray', '  - docker-compose.yaml (includes modules, adds PowerSync service)'));
    this.log(ux.colorize('gray', '  - .env'));
    this.log(ux.colorize('gray', `  - Merged config into ${SERVICE_FILENAME}`));
    this.log(ux.colorize('gray', `  - ${CLI_FILENAME} (plugins.docker.project_name: ${projectName})`));
    this.log('');
    this.log(`Next: run "${ux.colorize('blue', 'powersync docker start')}" to start the stack.`);
  }

  private async configureExistingStack(
    projectDirectory: string,
    flags: { dashboard?: boolean; database?: string; storage?: string }
  ): Promise<void> {
    if (flags.database !== undefined || flags.storage !== undefined || (!flags.dashboard && !process.stdin.isTTY)) {
      this.error(
        `Directory ${path.join(projectDirectory, 'docker')} already exists. Use --dashboard to add the dashboard to this stack.`
      );
    }

    if (!(await shouldConfigureDashboard(flags.dashboard))) {
      this.log('Kept the existing stack configuration.');
      return;
    }

    this.enableDashboard(projectDirectory);
    this.log('Run powersync docker start to start the stack.');
  }

  private enableDashboard(projectDirectory: string): void {
    enableStackDashboard(projectDirectory);
    this.log(
      'Dashboard enabled. Set PS_DASHBOARD_PORT, PS_DASHBOARD_ADMIN_URL or PS_DASHBOARD_CLIENT_URL in docker/.env to override the defaults.'
    );
  }
}

/** Create or update cli.yaml with type: self-hosted, api_url, api_key, and plugins.docker.project_name. */
function updateLinkPluginsDocker(projectDirectory: string, projectName: string): void {
  const linkPath = path.join(projectDirectory, CLI_FILENAME);
  const linkDocument = existsSync(linkPath)
    ? parseYamlDocumentPreserveTags(readFileSync(linkPath, 'utf8'))
    : new Document({});
  linkDocument.set('type', 'self-hosted');
  linkDocument.set('api_url', DOCKER_DEV_API_URL);
  linkDocument.set('api_key', DEV_TOKEN);

  const rawNode = linkDocument.get('plugins');
  if (isMap(rawNode)) {
    linkDocument.setIn(['plugins', 'docker', 'project_name'], projectName);
  } else {
    linkDocument.set('plugins', { docker: { project_name: projectName } });
  }

  writeFileSync(linkPath, stringify(linkDocument), 'utf8');
}
