import { Flags } from '@oclif/core';
import {
  LINK_FILENAME,
  parseYamlDocumentPreserveTags,
  SelfHostedInstanceCommand,
  SERVICE_FILENAME,
  type SelfHostedInstanceCommandFlags
} from '@powersync/cli-core';
import fs, { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Document, stringify } from 'yaml';
import { DEV_TOKEN } from '../../constants.js';
import { TEMPLATES } from '../../templates/templates-index.js';
import { DockerModuleContext, DockerModuleType } from '../../types.js';
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
  static summary = 'Compose database and storage modules into powersync/docker/.';
  static description =
    'Copy selected database and storage template modules into powersync/docker/modules/, generate a composed docker-compose.yaml and .env, and merge service config snippets into the project service.yaml. Run from repo root with --directory powersync.';

  static flags = {
    ...SelfHostedInstanceCommand.flags,
    database: Flags.string({
      description: 'Database module for replication source.',
      required: false,
      options: TEMPLATES[DockerModuleType.SOURCE_DATABASE].map((template) => template.name),
      default: TEMPLATES[DockerModuleType.SOURCE_DATABASE][0].name
    }),
    storage: Flags.string({
      description: 'Storage module for PowerSync bucket metadata.',
      required: false,
      options: TEMPLATES[DockerModuleType.STORAGE].map((template) => template.name),
      default: TEMPLATES[DockerModuleType.STORAGE][0].name
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerConfigure);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: false,
      linkingIsRequired: false
    });

    const targetDockerDir = path.join(projectDirectory, 'docker');
    const modulesDir = path.join(targetDockerDir, 'modules');
    const dockerEnvFilePath = path.join(targetDockerDir, '.env');

    if (existsSync(targetDockerDir)) {
      this.error(
        `Directory ${targetDockerDir} already exists. Remove it to re-run init, or use a different --directory.`,
        { exit: 1 }
      );
    }

    mkdirSync(targetDockerDir, { recursive: true });
    mkdirSync(modulesDir, { recursive: true });

    const dockerIncludePaths: string[] = [];
    const dockerServiceNames: string[] = [];

    const serviceConfigDocument = parseYamlDocumentPreserveTags(
      fs.readFileSync(path.join(projectDirectory, SERVICE_FILENAME), 'utf8')
    );

    const moduleContext: DockerModuleContext = {
      projectdirectory: projectDirectory,
      modulesOutputDirectory: modulesDir,
      serviceConfig: serviceConfigDocument
    };

    // Starting from scratch every time
    let envFileContents = '';

    if (flags.database) {
      const databaseTemplate = TEMPLATES[DockerModuleType.SOURCE_DATABASE].find(
        (template) => template.type === DockerModuleType.SOURCE_DATABASE && template.name === flags.database
      );
      if (!databaseTemplate) {
        this.error(`Database template ${flags.database} not found.`, { exit: 1 });
      }
      const databaseModuleResponse = await databaseTemplate.apply(moduleContext);

      dockerIncludePaths.push(...(databaseModuleResponse.dockerIncludePaths ?? []));
      dockerServiceNames.push(...(databaseModuleResponse.dockerServiceNames ?? []));

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

      dockerIncludePaths.push(...(storageModuleResponse.dockerIncludePaths ?? []));
      dockerServiceNames.push(...(storageModuleResponse.dockerServiceNames ?? []));

      envFileContents +=
        (envFileContents ? '\n\n' : '') +
        [
          `# ${storageTemplate.name} Storage Config`,
          ...Object.entries(storageModuleResponse.additionalEnviroment ?? {}).map(([key, value]) => `${key}=${value}`)
        ].join('\n');
    }

    const mainCompose = generateMainCompose(dockerIncludePaths, dockerServiceNames);
    writeFileSync(path.join(targetDockerDir, 'docker-compose.yaml'), mainCompose, 'utf8');

    // Persist environment config
    writeFileSync(dockerEnvFilePath, envFileContents, 'utf8');

    // Set api.tokens in service.yaml for local dev (same token as in link)
    serviceConfigDocument.set('api', { tokens: [DEV_TOKEN] });
    writeFileSync(path.join(projectDirectory, SERVICE_FILENAME), stringify(serviceConfigDocument), 'utf8');

    const projectName = composeProjectName(projectDirectory);
    updateLinkPluginsDocker(projectDirectory, projectName);

    this.log(`Configured ${targetDockerDir}`);
    this.log('  - docker-compose.yaml (includes modules, adds PowerSync service)');
    this.log('  - .env');
    this.log(`  - Merged config into ${SERVICE_FILENAME}`);
    this.log(`  - ${LINK_FILENAME} (plugins.docker.project_name: ${projectName})`);
    this.log('Next: run `powersync docker deploy`.');
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
  linkDocument.set('plugins', { ...(linkDocument.get('plugins') ?? {}), docker: { project_name: projectName } });
  writeFileSync(linkPath, linkDocument.toString(), 'utf8');
}

function generateMainCompose(includePaths: string[], dockerServiceNames: string[]): string {
  const includeBlock = includePaths.map((p) => `  - path: ${p}`).join('\n');
  const dependsOnBlock =
    dockerServiceNames.length > 0
      ? dockerServiceNames.map((name) => `      ${name}:\n        condition: service_healthy`).join('\n')
      : '    {}';
  return /* yaml */ `# Composed PowerSync Docker stack (generated by powersync docker init).
# Relative paths: . = powersync/docker, .. = powersync; only service.yaml and sync.yaml are mounted into the container.
# Include syntax requires Docker Compose v2.20.3+
# https://docs.docker.com/compose/compose-file/05-services/#include

include:
${includeBlock}

services:
  powersync:
    restart: unless-stopped
    image: journeyapps/powersync-service:latest
    command: ["start", "-r", "unified"]
    env_file:
      - .env
    volumes:
      - ../service.yaml:/config/service.yaml
      - ../sync.yaml:/config/sync.yaml
    environment:
      POWERSYNC_CONFIG_PATH: /config/service.yaml
      NODE_OPTIONS: --max-old-space-size=1000
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:${'$'}{PS_PORT:-8080}/probes/liveness').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))",
        ]
      interval: 5s
      timeout: 1s
      retries: 15
    ports:
      - "\${PS_PORT:-8080}:\${PS_PORT:-8080}"
    depends_on:
${dependsOnBlock}
`;
}
