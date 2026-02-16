import { ux } from '@oclif/core';
import { CLI_FILENAME, parseYamlDocumentPreserveTags } from '@powersync/cli-core';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const COMPOSE_FILENAME = 'docker-compose.yaml';
const POWERSYNC_PROJECT_PREFIX = 'powersync_';

export type DockerComposeOptions = {
  projectDirectory: string;
  /** Docker Compose project name (e.g. from cli.yaml plugins.docker.project_name). When set, passed as -p. */
  projectName?: string;
};

/**
 * Read Docker Compose project name from cli.yaml (plugins.docker.project_name). Returns undefined if missing.
 */
export function getDockerProjectName(projectDirectory: string): string | undefined {
  const linkPath = join(projectDirectory, CLI_FILENAME);
  if (!existsSync(linkPath)) return undefined;
  try {
    const obj = parseYamlDocumentPreserveTags(readFileSync(linkPath, 'utf8'));
    const jsonContent = obj.contents?.toJSON();
    return jsonContent?.plugins?.docker?.project_name;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the compose file path: {projectDirectory}/docker/docker-compose.yaml.
 */
export function resolveComposePath(options: DockerComposeOptions): string {
  return join(options.projectDirectory, 'docker', COMPOSE_FILENAME);
}

/**
 * List Docker Compose project names that start with powersync_ and have running containers.
 * Runs `docker compose ls -q` (no -a) so only projects with running containers are returned.
 * Returns [] if the command fails or no matches.
 */
export function listPowersyncProjectNames(): string[] {
  try {
    const out = execSync('docker compose ls -q', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const names = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return names.filter((n) => n.startsWith(POWERSYNC_PROJECT_PREFIX));
  } catch {
    return [];
  }
}

/**
 * Log active PowerSync project names and how to stop them. Use after a failed reset or start.
 * @param excludeProjectName - Current project name to omit from the list (the instance we just tried to use).
 */
export function logPowersyncProjectsStopHelp(
  command: { log: (msg: string) => void },
  excludeProjectName?: string
): void {
  const projectNames = listPowersyncProjectNames().filter((name) => !excludeProjectName || name !== excludeProjectName);
  if (projectNames.length > 0) {
    command.log('');
    command.log('Other PowerSync Docker project(s) that are running:');
    projectNames.forEach((name) => command.log(`  - ${name}`));
    command.log('');
    command.log('To stop a project: ' + ux.colorize('blue', 'powersync docker stop --project-name=<name>'));
    command.log('Example: ' + ux.colorize('blue', `powersync docker stop --project-name=${projectNames[0]!}`));
  }
}

/**
 * Run `docker compose -p <projectName> stop`. Stops containers but does not remove them.
 * Does not require a compose file or project directory.
 */
export function runDockerComposeStop(projectName: string, execOptions?: { stdio?: 'inherit' | 'pipe' }): void {
  const cmd = `docker compose -p "${projectName}" stop`;
  execSync(cmd, {
    stdio: execOptions?.stdio ?? 'inherit',
    cwd: process.cwd()
  });
}

/**
 * Run `docker compose -p <projectName> down` (optionally with `-v` to remove volumes).
 * Stops and removes containers and networks. Does not require a compose file or project directory.
 */
export function runDockerComposeDown(
  projectName: string,
  execOptions?: { stdio?: 'inherit' | 'pipe'; removeVolumes?: boolean }
): void {
  const v = execOptions?.removeVolumes ? ' -v' : '';
  const cmd = `docker compose -p "${projectName}" down${v}`;
  execSync(cmd, {
    stdio: execOptions?.stdio ?? 'inherit',
    cwd: process.cwd()
  });
}

/**
 * Run docker compose with the given args. Uses execSync; throws if the process exits non-zero.
 * Runs with cwd = compose file directory so relative paths in the compose file (e.g. ..:/config) resolve correctly.
 */
export function runDockerCompose(
  options: DockerComposeOptions,
  args: string[],
  execOptions?: { stdio?: 'inherit' | 'pipe' }
): void {
  const composePath = resolveComposePath(options);
  if (!existsSync(composePath)) {
    throw new Error(
      `Compose file not found: ${composePath}. Run ${ux.colorize('blue', 'powersync docker configure')} to create the docker/ compose dir.`
    );
  }
  const composeDir = dirname(composePath);
  const projectFlag = options.projectName ? `-p "${options.projectName}" ` : '';
  const cmd = `docker compose ${projectFlag}-f "${composePath}" ${args.join(' ')}`;
  execSync(cmd, {
    stdio: execOptions?.stdio ?? 'inherit',
    cwd: composeDir
  });
}
