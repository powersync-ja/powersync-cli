import { parseYamlString } from '@powersync/cli-core';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const LINK_FILENAME = 'link.yaml';

export type DockerComposeOptions = {
  projectDirectory: string;
  /** Compose directory relative to project (default: docker). Compose file is always docker-compose.yaml inside it. */
  composeDir?: string;
  /** Docker Compose project name (e.g. from link.yaml plugins.docker.project_name). When set, passed as -p. */
  projectName?: string;
};

/**
 * Read Docker Compose project name from link.yaml (plugins.docker.project_name). Returns undefined if missing.
 */
export function getDockerProjectName(projectDirectory: string): string | undefined {
  const linkPath = join(projectDirectory, LINK_FILENAME);
  if (!existsSync(linkPath)) return undefined;
  try {
    const obj = parseYamlString(readFileSync(linkPath, 'utf8')) as Record<string, unknown> | undefined;
    const plugins = obj?.plugins as Record<string, unknown> | undefined;
    const docker = plugins?.docker as Record<string, unknown> | undefined;
    const name = docker?.project_name;
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

const COMPOSE_FILENAME = 'docker-compose.yaml';

/**
 * Resolve the compose file path: {projectDirectory}/{composeDir}/docker-compose.yaml (default composeDir: docker).
 */
export function resolveComposePath(options: DockerComposeOptions): string {
  const dir = options.composeDir ?? 'docker';
  return join(options.projectDirectory, dir, COMPOSE_FILENAME);
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
      `Compose file not found: ${composePath}. Run \`powersync docker init\` to create the docker/ compose dir, or set --compose-dir.`
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
