// 메인 contracts/workOS.ts 와 동일한 타입 — 런타임 코드 공유 금지, type-only 미러.

export type Step = {
  id: string;
  name: string;
  description: string;
  agentNames: string[];
  tags?: string[];
  createdAt: number;
  updatedAt: number;
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  stepIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'archived';
export type Task = {
  id: string;
  workflowId: string;
  requirement: string;
  title: string;
  status: TaskStatus;
  taskItemIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type TaskItemStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type TaskItem = {
  id: string;
  taskId: string;
  stepId: string;
  workflowId: string;
  name: string;
  description: string;
  prompt: string;
  agentName: string;
  dependsOn?: string[];
  status: TaskItemStatus;
  sessionId?: string;
  promptFilePath?: string;
  output?: string;
  artifactPath?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
};

export type ListByWorkspaceRequest = { workspaceId: string };

export type CreateStepRequest = {
  workspaceId: string;
  name: string;
  description?: string;
  agentNames: string[];
  tags?: string[];
};
export type UpdateStepRequest = {
  workspaceId: string;
  id: string;
  patch: Partial<Pick<Step, 'name' | 'description' | 'agentNames' | 'tags'>>;
};
export type DeleteStepRequest = { workspaceId: string; id: string };

export type FindDuplicateStepsRequest = { workspaceId: string };
export type DuplicateStepGroup = {
  key: string;
  survivor: Step;
  duplicates: Step[];
  affectedWorkflowIds: string[];
};
export type FindDuplicateStepsResponse = { groups: DuplicateStepGroup[] };
export type MergeDuplicateStepsRequest = {
  workspaceId: string;
  groups: Array<{ survivorId: string; duplicateIds: string[] }>;
};
export type MergeDuplicateStepsResponse = {
  deletedStepIds: string[];
  updatedWorkflowIds: string[];
};

export type CreateWorkflowRequest = {
  workspaceId: string;
  name: string;
  description?: string;
  stepIds?: string[];
  tags?: string[];
};
export type UpdateWorkflowRequest = {
  workspaceId: string;
  id: string;
  patch: Partial<Pick<Workflow, 'name' | 'description' | 'stepIds' | 'tags'>>;
};
export type DeleteWorkflowRequest = { workspaceId: string; id: string };

export type CreateTaskRequest = {
  workspaceId: string;
  workflowId: string;
  title: string;
  requirement?: string;
};
export type UpdateTaskRequest = {
  workspaceId: string;
  id: string;
  patch: Partial<Pick<Task, 'title' | 'requirement' | 'status' | 'taskItemIds'>>;
};
export type DeleteTaskRequest = { workspaceId: string; id: string };
export type DecomposeTaskRequest = { workspaceId: string; taskId: string };

export type CreateTaskItemRequest = {
  workspaceId: string;
  taskId: string;
  stepId: string;
  name: string;
  description?: string;
  prompt?: string;
  agentName: string;
};
export type UpdateTaskItemRequest = {
  workspaceId: string;
  id: string;
  patch: Partial<
    Pick<TaskItem, 'name' | 'description' | 'prompt' | 'agentName' | 'status' | 'output' | 'error'>
  >;
};
export type DeleteTaskItemRequest = { workspaceId: string; id: string };
export type ExecuteTaskItemRequest = {
  workspaceId: string;
  taskItemId: string;
  cols?: number;
  rows?: number;
};
export type ExecuteTaskItemResponse = { sessionId: string; promptFilePath: string };

export type CatalogResponse = {
  agents: Array<{ name: string; description?: string }>;
  skills: Array<{ name: string; description?: string }>;
};

export type GitDiffResponse = {
  diff: string;
  hasChanges: boolean;
  changedFiles: string[];
};
export type GitCommitRequest = { workspaceId: string; message: string };
export type GitCommitResponse = { commitSha: string };

export type FileChangeKind =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'untracked'
  | 'unknown';

export type FileChange = {
  path: string;
  oldPath?: string;
  kind: FileChangeKind;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
};

export type GitStatusResponse = {
  files: FileChange[];
  hasChanges: boolean;
  hasStaged: boolean;
};

export type GitFileDiffRequest = {
  workspaceId: string;
  path: string;
  side: 'staged' | 'unstaged';
};
export type GitFileDiffResponse = {
  path: string;
  side: 'staged' | 'unstaged';
  diff: string;
  isBinary: boolean;
};

export type GitStagePathsRequest = { workspaceId: string; paths: string[] };
export type GitUnstagePathsRequest = { workspaceId: string; paths: string[] };

export type SeedPresetRequest = { workspaceId: string };
export type SeedPresetResponse = { workflowId: string };

export type RequestAiDecomposeRequest = {
  workspaceId: string;
  taskId: string;
  cols?: number;
  rows?: number;
};
export type RequestAiDecomposeResponse = {
  sessionId: string;
  promptFilePath: string;
  outputJsonPath: string;
};

export type ImportDecompositionRequest = { workspaceId: string; taskId: string };

export type RequestAiWorkflowGenRequest = {
  workspaceId: string;
  requirement: string;
  cols?: number;
  rows?: number;
};
export type RequestAiWorkflowGenResponse = {
  draftId: string;
  sessionId: string;
  promptFilePath: string;
  outputJsonPath: string;
};
export type ImportWorkflowDraftRequest = { workspaceId: string; draftId: string };
export type ImportWorkflowDraftResponse = { workflowId: string };

export type WorkOSChangedEvent = {
  workspaceId: string;
  kinds: Array<'step' | 'workflow' | 'task' | 'task-item'>;
};
