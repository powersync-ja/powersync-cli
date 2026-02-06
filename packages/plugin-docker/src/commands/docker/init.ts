import { Flags } from '@oclif/core';
import {
  parseYamlDocumentPreserveTags,
  parseYamlFile,
  parseYamlString,
  SelfHostedInstanceCommand,
  stringifyYaml,
  type SelfHostedInstanceCommandFlags
} from '@powersync/cli-core';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Plugin package root (parent of dist/ when built); templates live at package root. */
const PACKAGE_ROOT = join(__dirname, '..', '..', '..');
const TEMPLATES_DIR = join(PACKAGE_ROOT, 'templates');

const DATABASE_OPTIONS = ['postgres'] as const;
const STORAGE_OPTIONS = ['postgres'] as const;

const SERVICE_FILENAME = 'service.yaml';
const LINK_FILENAME = 'link.yaml';
const ENV_TEMPLATE_FILENAME = 'template.env';

/** Docker Compose project name: [a-z0-9][a-z0-9_.-]*. Derive from directory name or use provided name. */
function composeProjectName(projectDirectory: string, explicitName?: string): string {
  const raw = explicitName ?? (basename(projectDirectory) || 'powersync');
  const sanitized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || 'powersync';
}

type DatabaseOption = (typeof DATABASE_OPTIONS)[number];
type StorageOption = (typeof STORAGE_OPTIONS)[number];

/** Compose file name per module: <impl>.<category>.compose.yaml */
function composeFileName(impl: string, category: string): string {
  return `${impl}.${category}.compose.yaml`;
}

/** Service snippet name per module: <impl>.<category>.service.yaml */
function serviceSnippetName(impl: string, category: string): string {
  return `${impl}.${category}.service.yaml`;
}

export default class DockerInit extends SelfHostedInstanceCommand {
  static summary = 'Compose database and storage modules into powersync/docker/.';
  static description =
    'Copy selected database and storage template modules into powersync/docker/modules/, generate a composed docker-compose.yaml and .env, and merge service config snippets into the project service.yaml. Run from repo root with --directory powersync.';

  static flags = {
    ...SelfHostedInstanceCommand.flags,
    database: Flags.string({
      description: 'Database module for replication source.',
      required: true,
      options: [...DATABASE_OPTIONS]
    }),
    storage: Flags.string({
      description: 'Storage module for PowerSync bucket metadata.',
      required: true,
      options: [...STORAGE_OPTIONS]
    }),
    'project-name': Flags.string({
      description: 'Docker Compose project name (default: derived from config directory name).',
      required: false
    })
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(DockerInit);
    const { projectDirectory } = this.loadProject(flags as SelfHostedInstanceCommandFlags, {
      configFileRequired: false,
      linkingIsRequired: false
    });

    const database = flags.database as DatabaseOption;
    const storage = flags.storage as StorageOption;
    const targetDockerDir = join(projectDirectory, 'docker');
    const modulesDir = join(targetDockerDir, 'modules');

    if (existsSync(targetDockerDir)) {
      this.error(
        `Directory ${targetDockerDir} already exists. Remove it to re-run init, or use a different --directory.`,
        { exit: 1 }
      );
    }

    const dbTemplatePath = join(TEMPLATES_DIR, 'database', database);
    const storageTemplatePath = join(TEMPLATES_DIR, 'storage', storage);

    if (!existsSync(dbTemplatePath)) {
      this.error(`Database template "${database}" not found at ${dbTemplatePath}.`, { exit: 1 });
    }
    if (!existsSync(storageTemplatePath)) {
      this.error(`Storage template "${storage}" not found at ${storageTemplatePath}.`, { exit: 1 });
    }

    mkdirSync(targetDockerDir, { recursive: true });
    mkdirSync(modulesDir, { recursive: true });

    const dbModuleDir = join(modulesDir, `database-${database}`);
    const storageModuleDir = join(modulesDir, `storage-${storage}`);

    cpSync(dbTemplatePath, dbModuleDir, { recursive: true });
    cpSync(storageTemplatePath, storageModuleDir, { recursive: true });

    const dbComposeName = composeFileName(database, 'database');
    const storageComposeName = composeFileName(storage, 'storage');
    const includePaths = [
      `modules/database-${database}/${dbComposeName}`,
      `modules/storage-${storage}/${storageComposeName}`
    ];
    const mainCompose = generateMainCompose(includePaths);
    writeFileSync(join(targetDockerDir, 'docker-compose.yaml'), mainCompose, 'utf8');

    const envContent = mergeEnvTemplates(database, storage);
    writeFileSync(join(targetDockerDir, '.env'), envContent, 'utf8');

    mergeServiceSnippets(projectDirectory, database, storage);

    const projectName = composeProjectName(projectDirectory, flags['project-name']);
    updateLinkPluginsDocker(projectDirectory, projectName);

    this.log(`Created ${targetDockerDir} with database=${database}, storage=${storage}.`);
    this.log('  - modules/database-' + database + '/');
    this.log('  - modules/storage-' + storage + '/');
    this.log('  - docker-compose.yaml (includes modules, adds PowerSync service)');
    this.log('  - .env');
    this.log(`  - Merged database and storage snippets into ${SERVICE_FILENAME}`);
    this.log(`  - ${LINK_FILENAME} (plugins.docker.project_name: ${projectName})`);
    this.log('Next: run `powersync docker deploy`.');
  }
}

/** Create or update link.yaml with type: self-hosted and plugins.docker.project_name. */
function updateLinkPluginsDocker(projectDirectory: string, projectName: string): void {
  const linkPath = join(projectDirectory, LINK_FILENAME);
  const obj: Record<string, unknown> = existsSync(linkPath)
    ? ((parseYamlString(readFileSync(linkPath, 'utf8')) as Record<string, unknown>) ?? {})
    : {};
  obj.type = 'self-hosted';
  const plugins = (obj.plugins as Record<string, unknown>) ?? {};
  plugins.docker = { ...((plugins.docker as Record<string, unknown>) ?? {}), project_name: projectName };
  obj.plugins = plugins;
  writeFileSync(linkPath, stringifyYaml(obj), 'utf8');
}

function mergeServiceSnippets(projectDirectory: string, database: DatabaseOption, storage: StorageOption): void {
  const servicePath = join(projectDirectory, SERVICE_FILENAME);
  const dbSnippetPath = join(TEMPLATES_DIR, 'database', database, serviceSnippetName(database, 'database'));
  const storageSnippetPath = join(TEMPLATES_DIR, 'storage', storage, serviceSnippetName(storage, 'storage'));

  const baseDoc = existsSync(servicePath)
    ? parseYamlFile(servicePath)
    : parseYamlDocumentPreserveTags('_type: self-hosted\n');

  const contents = baseDoc.contents as { get: (k: string) => unknown; set: (k: string, v: unknown) => void };
  if (existsSync(dbSnippetPath)) {
    const snippetDoc = parseYamlDocumentPreserveTags(readFileSync(dbSnippetPath, 'utf8'));
    const snippetContents = snippetDoc.contents as { get: (k: string) => unknown };
    const replication = snippetContents.get('replication');
    if (replication != null) contents.set('replication', replication);
  }
  if (existsSync(storageSnippetPath)) {
    const snippetDoc = parseYamlDocumentPreserveTags(readFileSync(storageSnippetPath, 'utf8'));
    const snippetContents = snippetDoc.contents as { get: (k: string) => unknown };
    const storage = snippetContents.get('storage');
    if (storage != null) contents.set('storage', storage);
  }

  writeFileSync(servicePath, baseDoc.toString(), 'utf8');
}

function generateMainCompose(includePaths: string[]): string {
  const includeBlock = includePaths.map((p) => `  - path: ${p}`).join('\n');
  return `# Composed PowerSync Docker stack (generated by powersync docker init).
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
      pg-db:
        condition: service_healthy
      pg-storage:
        condition: service_healthy
`;
}

/** Read and merge template.env snippets from selected database and storage modules, plus PowerSync common vars. */
function mergeEnvTemplates(database: DatabaseOption, storage: StorageOption): string {
  const parts: string[] = ['# PowerSync Docker stack.', ''];

  const dbEnvPath = join(TEMPLATES_DIR, 'database', database, ENV_TEMPLATE_FILENAME);
  if (existsSync(dbEnvPath)) {
    parts.push(readFileSync(dbEnvPath, 'utf8').trim(), '');
  }

  const storageEnvPath = join(TEMPLATES_DIR, 'storage', storage, ENV_TEMPLATE_FILENAME);
  if (existsSync(storageEnvPath)) {
    parts.push(readFileSync(storageEnvPath, 'utf8').trim(), '');
  }

  return parts.join('\n');
}
