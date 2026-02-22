/**
 * The Backend server provides the front-end with means to read and update certain PowerSync config files.
 */
import { SERVICE_FILENAME, SYNC_FILENAME } from '@powersync/cli-core';
import { createServerFn } from '@tanstack/react-start';

import fs from 'fs';
import path from 'node:path';
import { z } from 'zod';
import { env } from '../env';

export type FileItems = {
  name: string;
  type: string;
  content: string;
};

export type FilesResponse = {
  files: FileItems[];
};

const SaveFileRequest = z.object({
  filename: z.string(),
  content: z.string()
});

// GET request (default)
export const getConfigFiles = createServerFn().handler(async () => {
  const directoryPath = env.POWERSYNC_DIRECTORY;

  return {
    files: [
      {
        name: SYNC_FILENAME,
        type: 'application/yaml',
        content: await fs.promises.readFile(path.join(directoryPath, SYNC_FILENAME), 'utf8')
      },
      {
        name: SERVICE_FILENAME,
        type: 'application/yaml',
        content: await fs.promises.readFile(path.join(directoryPath, SERVICE_FILENAME), 'utf8')
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
