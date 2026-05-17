import { z } from 'zod';

export const terminalSummarySchema = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  cwd: z.string(),
  shell: z.string(),
  createdAt: z.number().int(),
  name: z.string(),
});
export type TerminalSummary = z.infer<typeof terminalSummarySchema>;

export const renameTerminalRequestSchema = z.object({
  sessionId: z.string(),
  name: z.string().min(1).max(64),
});
export type RenameTerminalRequest = z.infer<typeof renameTerminalRequestSchema>;

export const createTerminalRequestSchema = z.object({
  workspaceId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
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

export const listTerminalsRequestSchema = z.object({
  workspaceId: z.string().min(1),
});
export type ListTerminalsRequest = z.infer<typeof listTerminalsRequestSchema>;

export type TerminalDataEvent = {
  sessionId: string;
  data: string;
};

export type TerminalExitEvent = {
  sessionId: string;
  workspaceId: string;
  exitCode: number;
  signal: number | null;
};
