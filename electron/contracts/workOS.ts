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
