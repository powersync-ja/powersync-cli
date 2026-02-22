import { z } from 'zod';

export type FileItem = {
  filename: string;
  label: string;
  type: string;
  content: string;
};

export type FilesResponse = {
  files: FileItem[];
};

export const SaveFileRequest = z.object({
  filename: z.literal('service.yaml').or(z.literal('sync.yaml')),
  content: z.string()
});

export type SaveFileRequest = z.infer<typeof SaveFileRequest>;
