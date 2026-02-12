import { Flags, ux } from '@oclif/core';
import {
  LINK_FILENAME,
  parseYamlDocumentPreserveTags,
  SelfHostedInstanceCommand,
  SERVICE_FILENAME,
  type SelfHostedInstanceCommandFlags
} from '@powersync/cli-core';
import fs, { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, isMap, stringify } from 'yaml';
import { DEV_TOKEN } from '../../constants.js';
import { TEMPLATES } from '../../templates/templates-index.js';
import { DockerModuleContext, DockerModuleType } from '../../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAIN_COMPOSE_TEMPLATE_PATH = path.join(__dirname, '../../templates/main-compose.yaml');
const DOCKER_DEV_API_URL = 'http://localhost:8080';

/**
 * Docker Compose project name: [a-z0-9][a-z0-9_.-]*. Derived from the project direcotry name.
 */
function composeProjectName(projectDirectory: string): string {
  // The project name is the directory name of the parent directory.
  const raw = path.basename(path.resolve(projectDirectory, '../'));
  const sanitized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `powersync_${sanitized}`;
}

export default class DockerConfigure extends SelfHostedInstanceCommand {
  static summary = 'Configures a self hosted project with Docker Compose services.';

  static description = [
    'Configures a self hosted project with Docker Compose services.',
    'Docker configuration is located in ./powersync/docker/.',
    'Configured projects can be started with "powersync docker start".'
  ].join('\n');

  static flags = {
    ...SelfHostedInstanceCommand.flags,
    database: Flags.string({
      description: 'Database module for replication source.',
      required: true,
      options: TEMPLATES[DockerModuleType.SOURCE_DATABASE].map((template) => template.name)
    }),
    storage: Flags.string({
      description: 'Storage module for PowerSync bucket metadata.',
      required: true,
      options: TEMPLATES[DockerModuleType.STORAGE].map((template) => template.name)
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerConfigure);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: true
    });

    const targetDockerDir = path.join(projectDirectory, 'docker');
    const modulesDir = path.join(targetDockerDir, 'modules');
    const dockerEnvFilePath = path.join(targetDockerDir, '.env');

    if (existsSync(targetDockerDir)) {
      this.error(
        ux.colorize('red', [`Directory ${targetDockerDir} already exists.`, 'Remove it to re-configure.'].join('\n')),
        {
          exit: 1
        }
      );
    }

    mkdirSync(targetDockerDir, { recursive: true });
    mkdirSync(modulesDir, { recursive: true });

    const serviceConfigDocument = parseYamlDocumentPreserveTags(
      fs.readFileSync(path.join(projectDirectory, SERVICE_FILENAME), 'utf8')
    );

    const mainComposeDocument = parseYamlDocumentPreserveTags(readFileSync(MAIN_COMPOSE_TEMPLATE_PATH, 'utf8'));

    const moduleContext: DockerModuleContext = {
      command: this,
      projectdirectory: projectDirectory,
      composeOutputDirectory: targetDockerDir,
      modulesOutputDirectory: modulesDir,
      mainComposeDocument,
      serviceConfig: serviceConfigDocument
    };

    // Starting from scratch every time
    let envFileContents = '';

    if (flags.database) {
      const databaseTemplate = TEMPLATES[DockerModuleType.SOURCE_DATABASE].find(
        (template) => template.type === DockerModuleType.SOURCE_DATABASE && template.name === flags.database
      );
      if (!databaseTemplate) {
        this.error(ux.colorize('red', `Database template ${flags.database} not found.`), { exit: 1 });
      }
      const databaseModuleResponse = await databaseTemplate.apply(moduleContext);

      envFileContents += [
        `# ${databaseTemplate.name} Database Config`,
        ...Object.entries(databaseModuleResponse.additionalEnviroment ?? {}).map(([key, value]) => `${key}=${value}`)
      ].join('\n');
    }

    if (flags.storage) {
      const storageTemplate = TEMPLATES[DockerModuleType.STORAGE].find(
        (template) => template.type === DockerModuleType.STORAGE && template.name === flags.storage
      );
      if (!storageTemplate) {
        this.error(`Storage template ${flags.storage} not found.`, { exit: 1 });
      }
      const storageModuleResponse = await storageTemplate.apply(moduleContext);

      envFileContents +=
        (envFileContents ? '\n\n' : '') +
        [
          `# ${storageTemplate.name} Storage Config`,
          ...Object.entries(storageModuleResponse.additionalEnviroment ?? {}).map(([key, value]) => `${key}=${value}`)
        ].join('\n');
    }

    const projectName = composeProjectName(projectDirectory);
    mainComposeDocument.set('name', projectName);
    writeFileSync(path.join(targetDockerDir, 'docker-compose.yaml'), stringify(mainComposeDocument), 'utf8');

    // Persist environment config
    writeFileSync(dockerEnvFilePath, envFileContents, 'utf8');

    // Set api.tokens in service.yaml for local dev (same token as in link)
    serviceConfigDocument.set('api', { tokens: [DEV_TOKEN] });
    writeFileSync(path.join(projectDirectory, SERVICE_FILENAME), stringify(serviceConfigDocument), 'utf8');
    updateLinkPluginsDocker(projectDirectory, projectName);

    this.log(ux.colorize('green', `Configured ${targetDockerDir}`));
    this.log(ux.colorize('gray', '  - docker-compose.yaml (includes modules, adds PowerSync service)'));
    this.log(ux.colorize('gray', '  - .env'));
    this.log(ux.colorize('gray', `  - Merged config into ${SERVICE_FILENAME}`));
    this.log(ux.colorize('gray', `  - ${LINK_FILENAME} (plugins.docker.project_name: ${projectName})`));
    this.log(`Next: run "${ux.colorize('blue', 'powersync docker start')}" to start the stack.`);
  }
}

/** Create or update link.yaml with type: self-hosted, api_url, api_key, and plugins.docker.project_name. */
function updateLinkPluginsDocker(projectDirectory: string, projectName: string): void {
  const linkPath = path.join(projectDirectory, LINK_FILENAME);
  const linkDocument = existsSync(linkPath)
    ? parseYamlDocumentPreserveTags(readFileSync(linkPath, 'utf8'))
    : new Document({});
  linkDocument.set('type', 'self-hosted');
  linkDocument.set('api_url', DOCKER_DEV_API_URL);
  linkDocument.set('api_key', DEV_TOKEN);

  const rawNode = linkDocument.get('plugins');
  if (isMap(rawNode)) {
    rawNode.set('docker', { project_name: projectName });
  } else {
    linkDocument.set('plugins', { docker: { project_name: projectName } });
  }
  writeFileSync(linkPath, stringify(linkDocument), 'utf8');
}
