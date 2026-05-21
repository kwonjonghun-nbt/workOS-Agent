import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CHANNELS } from './contracts/channels';
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
} from './contracts/terminal';
import type {
  AddWorkspaceRequest,
  OpenDialogResponse,
  RemoveWorkspaceRequest,
  RenameWorkspaceRequest,
  SetActiveWorkspaceRequest,
  Workspace,
  WorkspaceChangedEvent,
} from './contracts/workspace';
import type {
  McpStatusRequest,
  McpStatusResponse,
  McpToastEvent,
  McpToolDescriptor,
  SetupMcpRequest,
  SetupMcpResponse,
} from './contracts/mcp';
import type { Preferences, SetThemeRequest } from './contracts/preferences';
import type { UpdaterStatus, UpdaterStatusEvent } from './contracts/updater';
import type {
  ExtensionListItem,
  ExtensionsChangedEvent,
  SetEnabledRequest,
  UpdateSettingsRequest,
} from './contracts/extension';
import type {
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  TestConnectionResponse,
} from './contracts/jira';
import type {
  TaskItemProgressEvent,
} from './contracts/workOS';
import type {
  CatalogResponse,
  CreateStepRequest,
  CreateTaskItemRequest,
  CreateTaskRequest,
  CreateWorkflowRequest,
  DecomposeTaskRequest,
  DeleteStepRequest,
  FindDuplicateStepsRequest,
  FindDuplicateStepsResponse,
  MergeDuplicateStepsRequest,
  MergeDuplicateStepsResponse,
  DeleteTaskItemRequest,
  DeleteTaskRequest,
  DeleteWorkflowRequest,
  ExecuteTaskItemRequest,
  ExecuteTaskItemResponse,
  GitCommitRequest,
  GitCommitResponse,
  GitDiffResponse,
  GitFileDiffRequest,
  GitFileDiffResponse,
  GitStagePathsRequest,
  GitStatusResponse,
  GitUnstagePathsRequest,
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
} from './contracts/workOS';

const terminal = {
  create: (req: CreateTerminalRequest): Promise<CreateTerminalResponse> =>
    ipcRenderer.invoke(CHANNELS.terminal.create, req),
  write: (req: WriteTerminalRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.terminal.write, req),
  resize: (req: ResizeTerminalRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.terminal.resize, req),
  dispose: (req: DisposeTerminalRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.terminal.dispose, req),
  rename: (req: RenameTerminalRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.terminal.rename, req),
  list: (req: ListTerminalsRequest): Promise<TerminalSummary[]> =>
    ipcRenderer.invoke(CHANNELS.terminal.list, req),
  onData: (listener: (event: TerminalDataEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, payload: TerminalDataEvent) => listener(payload);
    ipcRenderer.on(CHANNELS.terminalEvents.data, wrapped);
    return () => ipcRenderer.off(CHANNELS.terminalEvents.data, wrapped);
  },
  onExit: (listener: (event: TerminalExitEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, payload: TerminalExitEvent) => listener(payload);
    ipcRenderer.on(CHANNELS.terminalEvents.exit, wrapped);
    return () => ipcRenderer.off(CHANNELS.terminalEvents.exit, wrapped);
  },
};

const workspace = {
  list: (): Promise<Workspace[]> => ipcRenderer.invoke(CHANNELS.workspace.list),
  add: (req: AddWorkspaceRequest): Promise<Workspace> =>
    ipcRenderer.invoke(CHANNELS.workspace.add, req),
  remove: (req: RemoveWorkspaceRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.workspace.remove, req),
  rename: (req: RenameWorkspaceRequest): Promise<Workspace> =>
    ipcRenderer.invoke(CHANNELS.workspace.rename, req),
  setActive: (req: SetActiveWorkspaceRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.workspace.setActive, req),
  openDialog: (): Promise<OpenDialogResponse> => ipcRenderer.invoke(CHANNELS.workspace.openDialog),
  onChanged: (listener: (event: WorkspaceChangedEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, payload: WorkspaceChangedEvent) => listener(payload);
    ipcRenderer.on(CHANNELS.workspaceEvents.changed, wrapped);
    return () => ipcRenderer.off(CHANNELS.workspaceEvents.changed, wrapped);
  },
};

const workOS = {
  listSteps: (req: ListByWorkspaceRequest): Promise<Step[]> =>
    ipcRenderer.invoke(CHANNELS.workOS.listSteps, req),
  createStep: (req: CreateStepRequest): Promise<Step> =>
    ipcRenderer.invoke(CHANNELS.workOS.createStep, req),
  updateStep: (req: UpdateStepRequest): Promise<Step> =>
    ipcRenderer.invoke(CHANNELS.workOS.updateStep, req),
  deleteStep: (req: DeleteStepRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.workOS.deleteStep, req),
  findDuplicateSteps: (req: FindDuplicateStepsRequest): Promise<FindDuplicateStepsResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.findDuplicateSteps, req),
  mergeDuplicateSteps: (req: MergeDuplicateStepsRequest): Promise<MergeDuplicateStepsResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.mergeDuplicateSteps, req),

  listWorkflows: (req: ListByWorkspaceRequest): Promise<Workflow[]> =>
    ipcRenderer.invoke(CHANNELS.workOS.listWorkflows, req),
  createWorkflow: (req: CreateWorkflowRequest): Promise<Workflow> =>
    ipcRenderer.invoke(CHANNELS.workOS.createWorkflow, req),
  updateWorkflow: (req: UpdateWorkflowRequest): Promise<Workflow> =>
    ipcRenderer.invoke(CHANNELS.workOS.updateWorkflow, req),
  deleteWorkflow: (req: DeleteWorkflowRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.workOS.deleteWorkflow, req),

  listTasks: (req: ListByWorkspaceRequest): Promise<Task[]> =>
    ipcRenderer.invoke(CHANNELS.workOS.listTasks, req),
  createTask: (req: CreateTaskRequest): Promise<Task> =>
    ipcRenderer.invoke(CHANNELS.workOS.createTask, req),
  updateTask: (req: UpdateTaskRequest): Promise<Task> =>
    ipcRenderer.invoke(CHANNELS.workOS.updateTask, req),
  deleteTask: (req: DeleteTaskRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.workOS.deleteTask, req),
  decomposeTask: (req: DecomposeTaskRequest): Promise<TaskItem[]> =>
    ipcRenderer.invoke(CHANNELS.workOS.decomposeTask, req),

  listTaskItems: (req: ListByWorkspaceRequest): Promise<TaskItem[]> =>
    ipcRenderer.invoke(CHANNELS.workOS.listTaskItems, req),
  createTaskItem: (req: CreateTaskItemRequest): Promise<TaskItem> =>
    ipcRenderer.invoke(CHANNELS.workOS.createTaskItem, req),
  updateTaskItem: (req: UpdateTaskItemRequest): Promise<TaskItem> =>
    ipcRenderer.invoke(CHANNELS.workOS.updateTaskItem, req),
  deleteTaskItem: (req: DeleteTaskItemRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.workOS.deleteTaskItem, req),
  executeTaskItem: (req: ExecuteTaskItemRequest): Promise<ExecuteTaskItemResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.executeTaskItem, req),

  catalog: (req: ListByWorkspaceRequest): Promise<CatalogResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.catalog, req),
  gitDiff: (req: ListByWorkspaceRequest): Promise<GitDiffResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.gitDiff, req),
  gitCommit: (req: GitCommitRequest): Promise<GitCommitResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.gitCommit, req),
  gitStatus: (req: ListByWorkspaceRequest): Promise<GitStatusResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.gitStatus, req),
  gitFileDiff: (req: GitFileDiffRequest): Promise<GitFileDiffResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.gitFileDiff, req),
  gitStagePaths: (req: GitStagePathsRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.workOS.gitStagePaths, req),
  gitUnstagePaths: (req: GitUnstagePathsRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.workOS.gitUnstagePaths, req),

  seedPreset: (req: SeedPresetRequest): Promise<SeedPresetResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.seedPreset, req),
  requestAiDecompose: (req: RequestAiDecomposeRequest): Promise<RequestAiDecomposeResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.requestAiDecompose, req),
  importDecomposition: (req: ImportDecompositionRequest): Promise<TaskItem[]> =>
    ipcRenderer.invoke(CHANNELS.workOS.importDecomposition, req),
  requestAiWorkflowGen: (
    req: RequestAiWorkflowGenRequest,
  ): Promise<RequestAiWorkflowGenResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.requestAiWorkflowGen, req),
  importWorkflowDraft: (req: ImportWorkflowDraftRequest): Promise<ImportWorkflowDraftResponse> =>
    ipcRenderer.invoke(CHANNELS.workOS.importWorkflowDraft, req),

  onChanged: (listener: (event: WorkOSChangedEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, payload: WorkOSChangedEvent) => listener(payload);
    ipcRenderer.on(CHANNELS.workOSEvents.changed, wrapped);
    return () => ipcRenderer.off(CHANNELS.workOSEvents.changed, wrapped);
  },
};

const mcp = {
  status: (req: McpStatusRequest): Promise<McpStatusResponse> =>
    ipcRenderer.invoke(CHANNELS.mcp.status, req),
  setup: (req: SetupMcpRequest): Promise<SetupMcpResponse> =>
    ipcRenderer.invoke(CHANNELS.mcp.setup, req),
  listTools: (): Promise<McpToolDescriptor[]> => ipcRenderer.invoke(CHANNELS.mcp.listTools),
  onProgress: (listener: (event: TaskItemProgressEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, payload: TaskItemProgressEvent) => listener(payload);
    ipcRenderer.on(CHANNELS.mcpEvents.progress, wrapped);
    return () => ipcRenderer.off(CHANNELS.mcpEvents.progress, wrapped);
  },
  onToast: (listener: (event: McpToastEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, payload: McpToastEvent) => listener(payload);
    ipcRenderer.on(CHANNELS.mcpEvents.toast, wrapped);
    return () => ipcRenderer.off(CHANNELS.mcpEvents.toast, wrapped);
  },
};

const preferences = {
  getSync: (): Preferences => ipcRenderer.sendSync(CHANNELS.preferences.getSync) as Preferences,
  setTheme: (req: SetThemeRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.preferences.setTheme, req),
};

const updater = {
  getStatus: (): Promise<UpdaterStatus> => ipcRenderer.invoke(CHANNELS.updater.getStatus),
  check: (): Promise<UpdaterStatus> => ipcRenderer.invoke(CHANNELS.updater.check),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke(CHANNELS.updater.quitAndInstall),
  onStatus: (listener: (event: UpdaterStatusEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, payload: UpdaterStatusEvent) => listener(payload);
    ipcRenderer.on(CHANNELS.updaterEvents.status, wrapped);
    return () => ipcRenderer.off(CHANNELS.updaterEvents.status, wrapped);
  },
};

const extension = {
  list: (): Promise<ExtensionListItem[]> => ipcRenderer.invoke(CHANNELS.extension.list),
  setEnabled: (req: SetEnabledRequest): Promise<ExtensionListItem> =>
    ipcRenderer.invoke(CHANNELS.extension.setEnabled, req),
  updateSettings: (req: UpdateSettingsRequest): Promise<ExtensionListItem> =>
    ipcRenderer.invoke(CHANNELS.extension.updateSettings, req),
  onChanged: (listener: (event: ExtensionsChangedEvent) => void): (() => void) => {
    const wrapped = (_e: IpcRendererEvent, payload: ExtensionsChangedEvent) => listener(payload);
    ipcRenderer.on(CHANNELS.extensionEvents.changed, wrapped);
    return () => ipcRenderer.off(CHANNELS.extensionEvents.changed, wrapped);
  },
};

const jira = {
  listMyIssues: (req: ListMyIssuesRequest): Promise<ListMyIssuesResponse> =>
    ipcRenderer.invoke(CHANNELS.jira.listMyIssues, req),
  testConnection: (): Promise<TestConnectionResponse> =>
    ipcRenderer.invoke(CHANNELS.jira.testConnection),
};

contextBridge.exposeInMainWorld('electronAPI', {
  terminal,
  workspace,
  workOS,
  mcp,
  preferences,
  updater,
  extension,
  jira,
});

export type ElectronAPI = {
  terminal: typeof terminal;
  workspace: typeof workspace;
  workOS: typeof workOS;
  mcp: typeof mcp;
  preferences: typeof preferences;
  updater: typeof updater;
  extension: typeof extension;
  jira: typeof jira;
};
