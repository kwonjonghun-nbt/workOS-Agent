import { z } from 'zod';

export const terminalPurposeSchema = z.enum(['user', 'extension']);
export type TerminalPurpose = z.infer<typeof terminalPurposeSchema>;

export const terminalSummarySchema = z.object({
  sessionId: z.string(),
  workspaceId: z.string(),
  cwd: z.string(),
  shell: z.string(),
  createdAt: z.number().int(),
  name: z.string(),
  purpose: terminalPurposeSchema.default('user'),
  ownerExtensionId: z.string().optional(),
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
  purpose: terminalPurposeSchema.default('user'),
  ownerExtensionId: z.string().min(1).optional(),
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
  // List defaults to user purpose so existing UI does not surface extension
  // terminals. Pass 'extension' (+ ownerExtensionId) to scope to a single
  // extension's terminals.
  purpose: terminalPurposeSchema.optional(),
  ownerExtensionId: z.string().min(1).optional(),
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
  ownerExtensionId?: string;
};

/**
 * Extension-owned terminal create — main process builds cwd from the system
 * default workspace's per-extension subdir and injects secrets as env vars.
 * Renderer never passes a workspaceId for this path.
 */
export const createExtensionTerminalRequestSchema = z.object({
  extensionId: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});
export type CreateExtensionTerminalRequest = z.infer<
  typeof createExtensionTerminalRequestSchema
>;
