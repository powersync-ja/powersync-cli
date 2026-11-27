import { CLI_FILENAME, parseYamlDocumentPreserveTags, SERVICE_FILENAME } from '@powersync/cli-core';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Document, isMap, isScalar, isSeq, Scalar } from 'yaml';

import { addServiceToken } from '../add-service-token.js';
import { replaceFile } from '../replace-file.js';

const TOKEN_KEY = 'PS_DASHBOARD_TOKEN';
const TOKEN_REFERENCE = `\${${TOKEN_KEY}:?Set ${TOKEN_KEY} in docker/.env}`;

const MANAGED_DASHBOARD = 'x-powersync-dashboard';
const PORT_MAPPING = `127.0.0.1:\${PS_DASHBOARD_PORT:-8090}:8080`;
const SERVICE_PORT = `\${PS_PORT:-8080}`;
const ADMIN_DEFAULT = `http://powersync:${SERVICE_PORT}`;
const CLIENT_DEFAULT = `http://localhost:${SERVICE_PORT}`;
const ADMIN_URL = `\${PS_DASHBOARD_ADMIN_URL:-${ADMIN_DEFAULT}}`;
const CLIENT_URL = `\${PS_DASHBOARD_CLIENT_URL:-${CLIENT_DEFAULT}}`;

function upgradeDashboardDefaults(compose: Document): boolean {
  const dashboard = ['services', 'dashboard'];
  let changed = false;
  for (const [path, previous, current] of [
    [[...dashboard, 'ports', 0], '127.0.0.1:8090:8080', PORT_MAPPING],
    [[...dashboard, 'environment', 'POWERSYNC_ADMIN_URL'], ADMIN_DEFAULT, ADMIN_URL],
    [[...dashboard, 'environment', 'POWERSYNC_CLIENT_URL'], CLIENT_DEFAULT, CLIENT_URL]
  ] as const) {
    const node = compose.getIn(path, true);
    if (isScalar(node) && node.value === previous) {
      node.value = current;
      changed = true;
    }
  }

  return changed;
}

function readDocument(path: string) {
  const document = parseYamlDocumentPreserveTags(readFileSync(path, 'utf8'));
  if (document.errors.length > 0) throw new Error(`Invalid YAML in ${path}.`);
  return document;
}

function configureDashboardEnvironment(envPath: string): void {
  const dotenv = readFileSync(envPath, 'utf8');
  const additions: string[] = [];
  if (!/^\s*(?:export\s+)?PS_DASHBOARD_TOKEN\s*=/m.test(dotenv)) {
    additions.push(`${TOKEN_KEY}=${randomBytes(32).toString('hex')}`);
  }

  if (!/^\s*(?:export\s+)?PS_DASHBOARD_PORT\s*=/m.test(dotenv)) additions.push('PS_DASHBOARD_PORT=8090');
  if (!/^\s*(?:export\s+)?PS_DASHBOARD_ADMIN_URL\s*=/m.test(dotenv)) additions.push('PS_DASHBOARD_ADMIN_URL=');
  if (!/^\s*(?:export\s+)?PS_DASHBOARD_CLIENT_URL\s*=/m.test(dotenv)) additions.push('PS_DASHBOARD_CLIENT_URL=');
  if (additions.length > 0) {
    const separator = dotenv.length > 0 && !dotenv.endsWith('\n') ? '\n' : '';
    replaceFile(envPath, `${dotenv}${separator}${additions.join('\n')}\n`, 0o600);
  }
}

export function enableStackDashboard(projectDirectory: string): void {
  const servicePath = join(projectDirectory, SERVICE_FILENAME);
  const composePath = join(projectDirectory, 'docker', 'docker-compose.yaml');
  const envPath = join(projectDirectory, 'docker', '.env');
  const service = readDocument(servicePath);
  const compose = readDocument(composePath);

  if (readDocument(join(projectDirectory, CLI_FILENAME)).get('type') !== 'self-hosted') {
    throw new Error('The dashboard requires a self-hosted project link.');
  }

  if (service.get('_type') !== 'self-hosted' || !isMap(compose.getIn(['services', 'powersync']))) {
    throw new Error('The dashboard requires a self-hosted Service and a Compose stack with a powersync service.');
  }

  const dashboard = compose.getIn(['services', 'dashboard']);
  if (dashboard !== undefined && compose.getIn(['services', 'dashboard', MANAGED_DASHBOARD]) !== true) {
    throw new Error(
      'The Compose stack already defines a dashboard service. Rename it before enabling the CLI dashboard.'
    );
  }

  const reference = new Scalar(TOKEN_KEY);
  reference.tag = '!env';
  const addedToken = addServiceToken(service, reference);

  const upgraded = dashboard && upgradeDashboardDefaults(compose);

  if (!dashboard) {
    const serviceEnv = compose.getIn(['services', 'powersync', 'environment']);
    if (isSeq(serviceEnv)) {
      if (serviceEnv.items.some((item) => String(item).split('=')[0] === TOKEN_KEY)) {
        throw new Error(
          `The powersync service already defines ${TOKEN_KEY}. Resolve the conflict before enabling the dashboard.`
        );
      }

      serviceEnv.add(`${TOKEN_KEY}=${TOKEN_REFERENCE}`);
    } else {
      if (serviceEnv !== undefined && (!isMap(serviceEnv) || serviceEnv.has(TOKEN_KEY))) {
        throw new Error(`Cannot add ${TOKEN_KEY} to the existing powersync service environment.`);
      }

      compose.setIn(['services', 'powersync', 'environment', TOKEN_KEY], TOKEN_REFERENCE);
    }

    compose.setIn(['services', 'dashboard'], {
      cap_drop: ['ALL'],
      environment: {
        POWERSYNC_ADMIN_TOKEN: TOKEN_REFERENCE,
        POWERSYNC_ADMIN_URL: ADMIN_URL,
        POWERSYNC_CLIENT_URL: CLIENT_URL
      },
      image: 'powersync/powersync-dashboard:latest',
      [MANAGED_DASHBOARD]: true,
      ports: [PORT_MAPPING],
      read_only: true,
      security_opt: ['no-new-privileges:true'],
      tmpfs: ['/tmp']
    });
  }

  // Provision the secret before publishing the references. A retry reuses it.
  configureDashboardEnvironment(envPath);

  if (addedToken) replaceFile(servicePath, service.toString());
  if (!dashboard || upgraded) replaceFile(composePath, compose.toString());
}
