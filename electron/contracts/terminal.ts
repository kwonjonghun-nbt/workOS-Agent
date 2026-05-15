import { z } from 'zod';

export const createTerminalRequestSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  cwd: z.string().optional(),
});
export type CreateTerminalRequest = z.infer<typeof createTerminalRequestSchema>;

export const createTerminalResponseSchema = z.object({
  sessionId: z.string(),
});
export type CreateTerminalResponse = z.infer<typeof createTerminalResponseSchema>;

export const writeTerminalRequestSchema = z.object({
  sessionId: z.string(),
  data: z.string(),
});
export type WriteTerminalRequest = z.infer<typeof writeTerminalRequestSchema>;

export const resizeTerminalRequestSchema = z.object({
  sessionId: z.string(),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});
export type ResizeTerminalRequest = z.infer<typeof resizeTerminalRequestSchema>;

export const disposeTerminalRequestSchema = z.object({
  sessionId: z.string(),
});
export type DisposeTerminalRequest = z.infer<typeof disposeTerminalRequestSchema>;

export type TerminalDataEvent = {
  sessionId: string;
  data: string;
};

export type TerminalExitEvent = {
  sessionId: string;
  exitCode: number;
  signal: number | null;
};
