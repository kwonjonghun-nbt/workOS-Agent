import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  DisposeTerminalRequest,
  ListTerminalsRequest,
  RenameTerminalRequest,
  ResizeTerminalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalSummary,
  WriteTerminalRequest,
} from './terminal/types';
import type {
  AddWorkspaceRequest,
  OpenDialogResponse,
  RemoveWorkspaceRequest,
  RenameWorkspaceRequest,
  SetActiveWorkspaceRequest,
  Workspace,
  WorkspaceChangedEvent,
} from './workspace/types';
import type {
  CatalogResponse,
  CreateStepRequest,
  CreateTaskItemRequest,
  CreateTaskRequest,
  CreateWorkflowRequest,
  DecomposeTaskRequest,
  DeleteStepRequest,
  DeleteTaskItemRequest,
  DeleteTaskRequest,
  DeleteWorkflowRequest,
  ExecuteTaskItemRequest,
  ExecuteTaskItemResponse,
  GitCommitRequest,
  GitCommitResponse,
  GitDiffResponse,
  ImportDecompositionRequest,
  ImportWorkflowDraftRequest,
  ImportWorkflowDraftResponse,
  ListByWorkspaceRequest,
  RequestAiDecomposeRequest,
  RequestAiDecomposeResponse,
  RequestAiWorkflowGenRequest,
  RequestAiWorkflowGenResponse,
  SeedPresetRequest,
  SeedPresetResponse,
  Step,
  Task,
  TaskItem,
  UpdateStepRequest,
  UpdateTaskItemRequest,
  UpdateTaskRequest,
  UpdateWorkflowRequest,
  Workflow,
  WorkOSChangedEvent,
} from './workOS/types';
import type {
  McpStatusRequest,
  McpStatusResponse,
  McpToastEvent,
  McpToolDescriptor,
  SetupMcpRequest,
  SetupMcpResponse,
  TaskItemProgressEvent,
} from './mcp/types';

export type TerminalApi = {
  create: (req: CreateTerminalRequest) => Promise<CreateTerminalResponse>;
  write: (req: WriteTerminalRequest) => Promise<void>;
  resize: (req: ResizeTerminalRequest) => Promise<void>;
  dispose: (req: DisposeTerminalRequest) => Promise<void>;
  rename: (req: RenameTerminalRequest) => Promise<void>;
  list: (req: ListTerminalsRequest) => Promise<TerminalSummary[]>;
  onData: (listener: (event: TerminalDataEvent) => void) => () => void;
  onExit: (listener: (event: TerminalExitEvent) => void) => () => void;
};

export type WorkspaceApi = {
  list: () => Promise<Workspace[]>;
  add: (req: AddWorkspaceRequest) => Promise<Workspace>;
  remove: (req: RemoveWorkspaceRequest) => Promise<void>;
  rename: (req: RenameWorkspaceRequest) => Promise<Workspace>;
  setActive: (req: SetActiveWorkspaceRequest) => Promise<void>;
  openDialog: () => Promise<OpenDialogResponse>;
  onChanged: (listener: (event: WorkspaceChangedEvent) => void) => () => void;
};

export type WorkOSApi = {
  listSteps: (req: ListByWorkspaceRequest) => Promise<Step[]>;
  createStep: (req: CreateStepRequest) => Promise<Step>;
  updateStep: (req: UpdateStepRequest) => Promise<Step>;
  deleteStep: (req: DeleteStepRequest) => Promise<void>;

  listWorkflows: (req: ListByWorkspaceRequest) => Promise<Workflow[]>;
  createWorkflow: (req: CreateWorkflowRequest) => Promise<Workflow>;
  updateWorkflow: (req: UpdateWorkflowRequest) => Promise<Workflow>;
  deleteWorkflow: (req: DeleteWorkflowRequest) => Promise<void>;

  listTasks: (req: ListByWorkspaceRequest) => Promise<Task[]>;
  createTask: (req: CreateTaskRequest) => Promise<Task>;
  updateTask: (req: UpdateTaskRequest) => Promise<Task>;
  deleteTask: (req: DeleteTaskRequest) => Promise<void>;
  decomposeTask: (req: DecomposeTaskRequest) => Promise<TaskItem[]>;

  listTaskItems: (req: ListByWorkspaceRequest) => Promise<TaskItem[]>;
  createTaskItem: (req: CreateTaskItemRequest) => Promise<TaskItem>;
  updateTaskItem: (req: UpdateTaskItemRequest) => Promise<TaskItem>;
  deleteTaskItem: (req: DeleteTaskItemRequest) => Promise<void>;
  executeTaskItem: (req: ExecuteTaskItemRequest) => Promise<ExecuteTaskItemResponse>;

  catalog: (req: ListByWorkspaceRequest) => Promise<CatalogResponse>;
  gitDiff: (req: ListByWorkspaceRequest) => Promise<GitDiffResponse>;
  gitCommit: (req: GitCommitRequest) => Promise<GitCommitResponse>;

  seedPreset: (req: SeedPresetRequest) => Promise<SeedPresetResponse>;
  requestAiDecompose: (req: RequestAiDecomposeRequest) => Promise<RequestAiDecomposeResponse>;
  importDecomposition: (req: ImportDecompositionRequest) => Promise<TaskItem[]>;
  requestAiWorkflowGen: (
    req: RequestAiWorkflowGenRequest,
  ) => Promise<RequestAiWorkflowGenResponse>;
  importWorkflowDraft: (req: ImportWorkflowDraftRequest) => Promise<ImportWorkflowDraftResponse>;

  onChanged: (listener: (event: WorkOSChangedEvent) => void) => () => void;
};

export type McpApi = {
  status: (req: McpStatusRequest) => Promise<McpStatusResponse>;
  setup: (req: SetupMcpRequest) => Promise<SetupMcpResponse>;
  listTools: () => Promise<McpToolDescriptor[]>;
  onProgress: (listener: (event: TaskItemProgressEvent) => void) => () => void;
  onToast: (listener: (event: McpToastEvent) => void) => () => void;
};

declare global {
  interface Window {
    electronAPI: {
      terminal: TerminalApi;
      workspace: WorkspaceApi;
      workOS: WorkOSApi;
      mcp: McpApi;
    };
  }
}
