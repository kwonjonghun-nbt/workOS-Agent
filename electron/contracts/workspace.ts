import { z } from 'zod';

export const workspaceKindSchema = z.enum(['user', 'system']);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  createdAt: z.number().int(),
  lastOpenedAt: z.number().int(),
  // Defaults to 'user'. 'system' workspaces are hidden from list() and act as
  // a sandbox for extension-owned terminals/CLI runs.
  kind: workspaceKindSchema.default('user'),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const addWorkspaceRequestSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).optional(),
});
export type AddWorkspaceRequest = z.infer<typeof addWorkspaceRequestSchema>;

export const removeWorkspaceRequestSchema = z.object({
  id: z.string().min(1),
});
export type RemoveWorkspaceRequest = z.infer<typeof removeWorkspaceRequestSchema>;

export const renameWorkspaceRequestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type RenameWorkspaceRequest = z.infer<typeof renameWorkspaceRequestSchema>;

export const setActiveWorkspaceRequestSchema = z.object({
  id: z.string().min(1),
});
export type SetActiveWorkspaceRequest = z.infer<typeof setActiveWorkspaceRequestSchema>;

export type OpenDialogResponse = { path: string | null };

export type WorkspaceChangedEvent = {
  workspaces: Workspace[];
};

// Fixed id for the singleton system default workspace. Stable across launches
// so extension state keyed by workspaceId is consistent.
export const SYSTEM_DEFAULT_WORKSPACE_ID = '__system_default__';
