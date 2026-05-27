import { z } from 'zod';

// ID — base64url 친화 문자만 (파일명 안전, path traversal 차단)
export const idSchema = z.string().regex(/^[A-Za-z0-9_-]+$/, 'invalid id');

export const stepSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  agentNames: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string()).optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Step = z.infer<typeof stepSchema>;

export const workflowSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  tags: z.array(z.string()).optional(),
  stepIds: z.array(idSchema),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Workflow = z.infer<typeof workflowSchema>;

export const taskStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'archived']);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskSchema = z.object({
  id: idSchema,
  workflowId: idSchema,
  requirement: z.string().default(''),
  title: z.string().min(1),
  status: taskStatusSchema,
  taskItemIds: z.array(idSchema),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskItemStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
]);
export type TaskItemStatus = z.infer<typeof taskItemStatusSchema>;

export const taskItemSchema = z.object({
  id: idSchema,
  taskId: idSchema,
  stepId: idSchema,
  workflowId: idSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  prompt: z.string().default(''),
  agentName: z.string().min(1),
  dependsOn: z.array(idSchema).optional(),
  status: taskItemStatusSchema,
  sessionId: z.string().optional(),
  promptFilePath: z.string().optional(),
  output: z.string().optional(),
  artifactPath: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  startedAt: z.number().optional(),
  finishedAt: z.number().optional(),
});
export type TaskItem = z.infer<typeof taskItemSchema>;

// --- Requests --------------------------------------------------------------

const workspaceIdReq = z.object({ workspaceId: z.string().min(1) });

export const listByWorkspaceRequestSchema = workspaceIdReq;
export type ListByWorkspaceRequest = z.infer<typeof listByWorkspaceRequestSchema>;

// Step
export const createStepRequestSchema = workspaceIdReq.extend({
  name: z.string().min(1),
  description: z.string().default(''),
  agentNames: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string()).optional(),
});
export type CreateStepRequest = z.infer<typeof createStepRequestSchema>;

export const updateStepRequestSchema = workspaceIdReq.extend({
  id: idSchema,
  patch: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      agentNames: z.array(z.string().min(1)).min(1).optional(),
      tags: z.array(z.string()).optional(),
    })
    .strict(),
});
export type UpdateStepRequest = z.infer<typeof updateStepRequestSchema>;

export const deleteStepRequestSchema = workspaceIdReq.extend({ id: idSchema });
export type DeleteStepRequest = z.infer<typeof deleteStepRequestSchema>;

// Step 중복 정리: 같은 name + agent 를 가진 Step 들을 그룹화해 미리 보여주고,
// 사용자가 승인한 그룹에 대해 survivor 1개만 남기고 나머지를 삭제한다.
// 삭제 전 모든 Workflow.stepIds 에서 duplicate id 를 survivor id 로 치환.
export const findDuplicateStepsRequestSchema = workspaceIdReq;
export type FindDuplicateStepsRequest = z.infer<typeof findDuplicateStepsRequestSchema>;

export const duplicateStepGroupSchema = z.object({
  key: z.string(),
  survivor: stepSchema,
  duplicates: z.array(stepSchema),
  affectedWorkflowIds: z.array(idSchema),
});
export type DuplicateStepGroup = z.infer<typeof duplicateStepGroupSchema>;

export const findDuplicateStepsResponseSchema = z.object({
  groups: z.array(duplicateStepGroupSchema),
});
export type FindDuplicateStepsResponse = z.infer<typeof findDuplicateStepsResponseSchema>;

export const mergeDuplicateStepsRequestSchema = workspaceIdReq.extend({
  groups: z
    .array(
      z.object({
        survivorId: idSchema,
        duplicateIds: z.array(idSchema).min(1),
      }),
    )
    .min(1),
});
export type MergeDuplicateStepsRequest = z.infer<typeof mergeDuplicateStepsRequestSchema>;

export const mergeDuplicateStepsResponseSchema = z.object({
  deletedStepIds: z.array(idSchema),
  updatedWorkflowIds: z.array(idSchema),
});
export type MergeDuplicateStepsResponse = z.infer<typeof mergeDuplicateStepsResponseSchema>;

// Workflow
export const createWorkflowRequestSchema = workspaceIdReq.extend({
  name: z.string().min(1),
  description: z.string().default(''),
  stepIds: z.array(idSchema).default([]),
  tags: z.array(z.string()).optional(),
});
export type CreateWorkflowRequest = z.infer<typeof createWorkflowRequestSchema>;

export const updateWorkflowRequestSchema = workspaceIdReq.extend({
  id: idSchema,
  patch: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      stepIds: z.array(idSchema).optional(),
      tags: z.array(z.string()).optional(),
    })
    .strict(),
});
export type UpdateWorkflowRequest = z.infer<typeof updateWorkflowRequestSchema>;

export const deleteWorkflowRequestSchema = workspaceIdReq.extend({ id: idSchema });
export type DeleteWorkflowRequest = z.infer<typeof deleteWorkflowRequestSchema>;

// Task
export const createTaskRequestSchema = workspaceIdReq.extend({
  workflowId: idSchema,
  title: z.string().min(1),
  requirement: z.string().default(''),
});
export type CreateTaskRequest = z.infer<typeof createTaskRequestSchema>;

export const updateTaskRequestSchema = workspaceIdReq.extend({
  id: idSchema,
  patch: z
    .object({
      title: z.string().min(1).optional(),
      requirement: z.string().optional(),
      status: taskStatusSchema.optional(),
      taskItemIds: z.array(idSchema).optional(),
    })
    .strict(),
});
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;

export const deleteTaskRequestSchema = workspaceIdReq.extend({ id: idSchema });
export type DeleteTaskRequest = z.infer<typeof deleteTaskRequestSchema>;

// 분해: 워크플로의 각 Step마다 TaskItem 1개씩(스텝의 첫 agent 기준) 자동 생성.
// AI 분해 자리는 추후 — 1차 버전은 결정적 시드.
export const decomposeTaskRequestSchema = workspaceIdReq.extend({ taskId: idSchema });
export type DecomposeTaskRequest = z.infer<typeof decomposeTaskRequestSchema>;

// TaskItem
export const createTaskItemRequestSchema = workspaceIdReq.extend({
  taskId: idSchema,
  stepId: idSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  prompt: z.string().default(''),
  agentName: z.string().min(1),
});
export type CreateTaskItemRequest = z.infer<typeof createTaskItemRequestSchema>;

export const updateTaskItemRequestSchema = workspaceIdReq.extend({
  id: idSchema,
  patch: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      prompt: z.string().optional(),
      agentName: z.string().min(1).optional(),
      status: taskItemStatusSchema.optional(),
      output: z.string().optional(),
      error: z.string().optional(),
    })
    .strict(),
});
export type UpdateTaskItemRequest = z.infer<typeof updateTaskItemRequestSchema>;

export const deleteTaskItemRequestSchema = workspaceIdReq.extend({ id: idSchema });
export type DeleteTaskItemRequest = z.infer<typeof deleteTaskItemRequestSchema>;

// 실행: TaskItem 의 prompt 를 임시 파일에 쓰고, 새 터미널 세션을 만들어
// claude CLI 로 "그 파일을 읽고 수행" 명령을 주입한다.
export const executeTaskItemRequestSchema = workspaceIdReq.extend({
  taskItemId: idSchema,
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
});
export type ExecuteTaskItemRequest = z.infer<typeof executeTaskItemRequestSchema>;

export const executeTaskItemResponseSchema = z.object({
  sessionId: z.string(),
  promptFilePath: z.string(),
});
export type ExecuteTaskItemResponse = z.infer<typeof executeTaskItemResponseSchema>;

// 카탈로그: 워크스페이스의 .claude/agents/*.md 와 .claude/skills/*.md 를 읽어 목록 노출
export const catalogResponseSchema = z.object({
  agents: z.array(z.object({ name: z.string(), description: z.string().optional() })),
  skills: z.array(z.object({ name: z.string(), description: z.string().optional() })),
});
export type CatalogResponse = z.infer<typeof catalogResponseSchema>;

// Diff / commit
export const gitDiffRequestSchema = workspaceIdReq;
export const gitDiffResponseSchema = z.object({
  diff: z.string(),
  hasChanges: z.boolean(),
  changedFiles: z.array(z.string()),
});
export type GitDiffResponse = z.infer<typeof gitDiffResponseSchema>;

// 파일 단위 상태 + 스테이징 — 신규/삭제/이름변경 포함.
export const fileChangeKindSchema = z.enum([
  'added',
  'modified',
  'deleted',
  'renamed',
  'untracked',
  'unknown',
]);
export type FileChangeKind = z.infer<typeof fileChangeKindSchema>;

export const fileChangeSchema = z.object({
  path: z.string(),
  oldPath: z.string().optional(),
  kind: fileChangeKindSchema,
  // X (index) / Y (worktree) 문자 그대로 보존 — UI 에서 staged/unstaged 구분.
  indexStatus: z.string().length(1),
  worktreeStatus: z.string().length(1),
  // 아래 두 boolean 은 indexStatus / worktreeStatus 에서 파생된 편의값.
  staged: z.boolean(),
  unstaged: z.boolean(),
});
export type FileChange = z.infer<typeof fileChangeSchema>;

export const gitStatusRequestSchema = workspaceIdReq;
export const gitStatusResponseSchema = z.object({
  files: z.array(fileChangeSchema),
  hasChanges: z.boolean(),
  hasStaged: z.boolean(),
});
export type GitStatusResponse = z.infer<typeof gitStatusResponseSchema>;

export const gitFileDiffRequestSchema = workspaceIdReq.extend({
  path: z.string().min(1),
  // 'staged' 면 index↔HEAD diff, 'unstaged' 면 worktree↔index diff (untracked 포함).
  side: z.enum(['staged', 'unstaged']),
});
export type GitFileDiffRequest = z.infer<typeof gitFileDiffRequestSchema>;

export const gitFileDiffResponseSchema = z.object({
  path: z.string(),
  side: z.enum(['staged', 'unstaged']),
  diff: z.string(),
  isBinary: z.boolean(),
});
export type GitFileDiffResponse = z.infer<typeof gitFileDiffResponseSchema>;

export const gitStagePathsRequestSchema = workspaceIdReq.extend({
  paths: z.array(z.string().min(1)).min(1),
});
export type GitStagePathsRequest = z.infer<typeof gitStagePathsRequestSchema>;

export const gitUnstagePathsRequestSchema = workspaceIdReq.extend({
  paths: z.array(z.string().min(1)).min(1),
});
export type GitUnstagePathsRequest = z.infer<typeof gitUnstagePathsRequestSchema>;

export const gitCommitRequestSchema = workspaceIdReq.extend({
  message: z.string().min(1),
});
export type GitCommitRequest = z.infer<typeof gitCommitRequestSchema>;

export const gitCommitResponseSchema = z.object({
  commitSha: z.string(),
});
export type GitCommitResponse = z.infer<typeof gitCommitResponseSchema>;

// Preset
export const seedPresetRequestSchema = z.object({ workspaceId: z.string().min(1) });
export type SeedPresetRequest = z.infer<typeof seedPresetRequestSchema>;
export type SeedPresetResponse = { workflowId: string };

// AI 분해
export const requestAiDecomposeRequestSchema = z.object({
  workspaceId: z.string().min(1),
  taskId: idSchema,
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
});
export type RequestAiDecomposeRequest = z.infer<typeof requestAiDecomposeRequestSchema>;
export type RequestAiDecomposeResponse = {
  sessionId: string;
  promptFilePath: string;
  outputJsonPath: string;
};

export const importDecompositionRequestSchema = z.object({
  workspaceId: z.string().min(1),
  taskId: idSchema,
});
export type ImportDecompositionRequest = z.infer<typeof importDecompositionRequestSchema>;

// AI 워크플로 생성
export const requestAiWorkflowGenRequestSchema = z.object({
  workspaceId: z.string().min(1),
  requirement: z.string().min(1),
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
});
export type RequestAiWorkflowGenRequest = z.infer<typeof requestAiWorkflowGenRequestSchema>;
export type RequestAiWorkflowGenResponse = {
  draftId: string;
  sessionId: string;
  promptFilePath: string;
  outputJsonPath: string;
};

export const importWorkflowDraftRequestSchema = z.object({
  workspaceId: z.string().min(1),
  draftId: z.string().regex(/^[A-Za-z0-9_-]+$/),
});
export type ImportWorkflowDraftRequest = z.infer<typeof importWorkflowDraftRequestSchema>;
export type ImportWorkflowDraftResponse = { workflowId: string };

// AI 워크플로 수정 — 기존 워크플로를 자연어 지시로 수정.
// 출력 스키마는 생성과 동일하지만 import 시 신규 워크플로를 만들지 않고
// 대상 워크플로의 name/description/stepIds 를 교체한다.
export const requestAiWorkflowEditRequestSchema = z.object({
  workspaceId: z.string().min(1),
  workflowId: idSchema,
  instruction: z.string().min(1),
  cols: z.number().int().positive().default(80),
  rows: z.number().int().positive().default(24),
});
export type RequestAiWorkflowEditRequest = z.infer<typeof requestAiWorkflowEditRequestSchema>;
export type RequestAiWorkflowEditResponse = {
  draftId: string;
  sessionId: string;
  promptFilePath: string;
  outputJsonPath: string;
};

export const importWorkflowEditRequestSchema = z.object({
  workspaceId: z.string().min(1),
  workflowId: idSchema,
  draftId: z.string().regex(/^[A-Za-z0-9_-]+$/),
});
export type ImportWorkflowEditRequest = z.infer<typeof importWorkflowEditRequestSchema>;
export type ImportWorkflowEditResponse = { workflowId: string };

// MCP submit — direct decomposition push (no file)
export const decompositionSubmitItemSchema = z.object({
  stepId: idSchema,
  name: z.string().min(1),
  description: z.string().default(''),
  agentName: z.string().min(1),
  prompt: z.string().default(''),
});
export type DecompositionSubmitItem = z.infer<typeof decompositionSubmitItemSchema>;

export const submitDecompositionRequestSchema = z.object({
  workspaceId: z.string().min(1),
  taskId: idSchema,
  items: z.array(decompositionSubmitItemSchema).min(1),
});
export type SubmitDecompositionRequest = z.infer<typeof submitDecompositionRequestSchema>;

export const workflowDraftStepSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  agentName: z.string().min(1),
});

export const submitWorkflowDraftRequestSchema = z.object({
  workspaceId: z.string().min(1),
  draftId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().min(1),
  description: z.string().default(''),
  steps: z.array(workflowDraftStepSchema).min(1),
});
export type SubmitWorkflowDraftRequest = z.infer<typeof submitWorkflowDraftRequestSchema>;

// Push events
export type WorkOSChangedEvent = {
  workspaceId: string;
  kinds: Array<'step' | 'workflow' | 'task' | 'task-item'>;
};

export type TaskItemProgressEvent = {
  workspaceId: string;
  taskItemId: string;
  message: string;
  at: number;
};
