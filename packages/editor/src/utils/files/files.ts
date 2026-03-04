import type { SyncDiagnostic } from '@powersync/cli-core';

import { z } from 'zod';

/**
 * Individual file item returned from the editor files API.
 */
export type FileItem = {
  content: string;
  filename: string;
  label: string;
  type: string;
};

/**
 * Response to GET request to editor files API, containing an array of file items.
 */
export type FilesResponse = {
  files: FileItem[];
};

/**
 * Updates the local filesystem with the given file content. The editor calls this API when the user saves a file.
 */
export const SaveFileRequest = z.object({
  content: z.string(),
  filename: z.literal('service.yaml').or(z.literal('sync-config.yaml'))
});

export type SaveFileRequest = z.infer<typeof SaveFileRequest>;

/**
 * Validates the sync rules content and returns any issues found.
 */
export const ValidateSyncRulesRequest = z.object({
  content: z.string()
});

export type ValidateSyncRulesRequest = z.infer<typeof ValidateSyncRulesRequest>;

/**
 * Result from sync rules validation.
 */
export type ValidateSyncRulesResponse = {
  issues: SyncDiagnostic[];
  passed: boolean;
};
