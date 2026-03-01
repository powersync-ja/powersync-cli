import { z } from 'zod';

export type FileItem = {
  content: string;
  filename: string;
  label: string;
  type: string;
};

export type FilesResponse = {
  files: FileItem[];
};

export const SaveFileRequest = z.object({
  content: z.string(),
  filename: z.literal('service.yaml').or(z.literal('sync-config.yaml'))
});

export type SaveFileRequest = z.infer<typeof SaveFileRequest>;

export const ValidateSyncRulesRequest = z.object({
  content: z.string()
});

export type ValidateSyncRulesRequest = z.infer<typeof ValidateSyncRulesRequest>;

export type ValidateSyncRulesResponse = {
  issues: Array<{
    endColumn: number;
    endLineNumber: number;
    message: string;
    severity: 'error' | 'warning';
    source: string;
    startColumn: number;
    startLineNumber: number;
  }>;
  passed: boolean;
};
