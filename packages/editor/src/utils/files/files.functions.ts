/**
 * The Backend server provides the front-end with means to read and update certain PowerSync config files.
 */
import { createServerFn } from '@tanstack/react-start';
import fs from 'node:fs';
import path from 'node:path';

import { env } from '../../env';
import { type FilesResponse, SaveFileRequest, ValidateSyncRulesRequest } from './files';
import { validateSyncRulesWithCli } from './files.server';

// GET request (default)
export const getConfigFiles = createServerFn().handler(async () => {
  const projectContext = env.POWERSYNC_PROJECT_CONTEXT;
  if (!projectContext) {
    throw new Error('Missing POWERSYNC_PROJECT_CONTEXT. Start the editor via "powersync edit config".');
  }

  const directoryPath = projectContext.linkedProject.projectDirectory;

  return {
    files: [
      {
        content: await fs.promises.readFile(path.join(directoryPath, 'service.yaml'), 'utf8').catch((error) => {
          console.warn(`Failed to read service.yaml:`, error);
          return '';
        }),
        filename: 'service.yaml',
        label: 'Service Config',
        type: 'application/yaml'
      },
      {
        content: await fs.promises.readFile(path.join(directoryPath, 'sync-config.yaml'), 'utf8').catch((error) => {
          console.warn(`Failed to read sync-config.yaml:`, error);
          return '';
        }),
        filename: 'sync-config.yaml',
        label: 'Sync Config',
        type: 'application/yaml'
      }
    ]
  } satisfies FilesResponse;
});

// POST request
export const saveData = createServerFn({ method: 'POST' })
  .inputValidator(SaveFileRequest)
  .handler(async ({ data }) => {
    const projectContext = env.POWERSYNC_PROJECT_CONTEXT;
    if (!projectContext) {
      throw new Error('Missing POWERSYNC_PROJECT_CONTEXT. Start the editor via "powersync edit config".');
    }

    const outputPath = path.join(projectContext.linkedProject.projectDirectory, data.filename);
    await fs.promises.writeFile(outputPath, data.content, 'utf8');
    return { success: true };
  });

// POST request
export const validateSyncRules = createServerFn({ method: 'POST' })
  .inputValidator(ValidateSyncRulesRequest)
  .handler(async ({ data }) => {
    const projectContext = env.POWERSYNC_PROJECT_CONTEXT;
    if (!projectContext) {
      throw new Error('Missing POWERSYNC_PROJECT_CONTEXT. Start the editor via "powersync edit config".');
    }

    return validateSyncRulesWithCli(data.content);
  });
