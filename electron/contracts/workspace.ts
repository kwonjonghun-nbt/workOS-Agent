import { z } from 'zod';

export const workspaceKindSchema = z.enum(['user', 'system']);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

export const taskSourceSchema = z.enum(['local', 'jira']);
export type TaskSource = z.infer<typeof taskSourceSchema>;

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  createdAt: z.number().int(),
  lastOpenedAt: z.number().int(),
  // Defaults to 'user'. 'system' workspaces are hidden from list() and act as
  // a sandbox for extension-owned terminals/CLI runs.
  kind: workspaceKindSchema.default('user'),
  // Task source for all workflows under this workspace. Workspace-level
  // single setting — workflows do not override this.
  taskSource: taskSourceSchema.default('local'),
});
// 과거에는 워크스페이스 단위로 jiraDefaultIssueType 을 저장했다. 이제는 Task 모달에서
// 매번 선택하므로 더 이상 스키마에 없다 — 디스크에 남은 잔존 필드는 repository load 단계에서
// 무시되고, 다음 저장 시 자연스럽게 사라진다.
export type Workspace = z.infer<typeof workspaceSchema>;

export const updateWorkspaceSettingsRequestSchema = z.object({
  id: z.string().min(1),
  patch: z
    .object({
      taskSource: taskSourceSchema.optional(),
    })
    .strict(),
});
export type UpdateWorkspaceSettingsRequest = z.infer<
  typeof updateWorkspaceSettingsRequestSchema
>;

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
