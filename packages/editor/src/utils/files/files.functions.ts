/**
 * The Backend server provides the front-end with means to read and update certain PowerSync config files.
 */
import { SERVICE_FILENAME, SYNC_FILENAME } from '@powersync/cli-core';
import { createServerFn } from '@tanstack/react-start';

import fs from 'fs';
import path from 'node:path';
import { env } from '../../env';
import { SaveFileRequest, type FilesResponse } from './files';

// GET request (default)
export const getConfigFiles = createServerFn().handler(async () => {
  const directoryPath = env.POWERSYNC_DIRECTORY;

  return {
    files: [
      {
        filename: SERVICE_FILENAME,
        label: 'Service Config',
        type: 'application/yaml',
        content: await fs.promises.readFile(path.join(directoryPath, SERVICE_FILENAME), 'utf8').catch((ex) => {
          console.warn(`Failed to read ${SERVICE_FILENAME}:`, ex);
          return '';
        })
      },
      {
        filename: SYNC_FILENAME,
        label: 'Sync Config',
        type: 'application/yaml',
        content: await fs.promises.readFile(path.join(directoryPath, SYNC_FILENAME), 'utf8').catch((ex) => {
          console.warn(`Failed to read ${SYNC_FILENAME}:`, ex);
          return '';
        })
      }
    ]
  } satisfies FilesResponse;
});

// POST request
export const saveData = createServerFn({ method: 'POST' })
  .inputValidator(SaveFileRequest)
  .handler(async ({ data }) => {
    const outputPath = path.join(env.POWERSYNC_DIRECTORY, data.filename);
    await fs.promises.writeFile(outputPath, data.content, 'utf8');
    return { success: true };
  });
