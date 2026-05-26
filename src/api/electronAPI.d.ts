import type {
  CreateExtensionTerminalRequest,
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
import type { UpdaterStatus, UpdaterStatusEvent } from './updater/types';
import type {
  ExtensionListItem,
  ExtensionOpenPanelEvent,
  ExtensionsChangedEvent,
  SetEnabledRequest,
  UpdateSettingsRequest,
} from './extension/types';
import type {
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  TestConnectionResponse,
} from './jira/types';
import type {
  MetaData as JiraSnapshotMeta,
  StoredData as JiraSnapshotStored,
  SyncProgressEvent as JiraSyncProgressEvent,
  TriggerSyncRequest as JiraSnapshotTriggerRequest,
  TriggerSyncResponse as JiraSnapshotTriggerResponse,
} from './jira/snapshot-types';
import type {
  BulkReplaceRequest as JiraBulkReplaceRequest,
  BulkReplaceResponse as JiraBulkReplaceResponse,
  LabelNote as JiraLabelNote,
  SaveLabelNotesRequest as JiraSaveLabelNotesRequest,
  SearchByLabelRequest as JiraSearchByLabelRequest,
  SearchByLabelResponse as JiraSearchByLabelResponse,
  SuggestLabelRequest as JiraSuggestLabelRequest,
  SuggestLabelResponse as JiraSuggestLabelResponse,
  UpdateIssueLabelsRequest as JiraUpdateIssueLabelsRequest,
} from './jira/label-types';
import type {
  DeleteReportRequest as JiraDeleteReportRequest,
  GenerateReportRequest as JiraGenerateReportRequest,
  GenerateReportResponse as JiraGenerateReportResponse,
  GetReportRequest as JiraGetReportRequest,
  GetReportResponse as JiraGetReportResponse,
  ReportMeta as JiraReportMeta,
  SaveReportRequest as JiraSaveReportRequest,
} from './jira/report-types';
import type {
  DeleteTileRequest as MacroDeleteTileRequest,
  MacroState,
  PickPathRequest as MacroPickPathRequest,
  PickPathResponse as MacroPickPathResponse,
  RunTileRequest as MacroRunTileRequest,
  RunTileResponse as MacroRunTileResponse,
  SaveBoardRequest as MacroSaveBoardRequest,
  SuggestTileRequest as MacroSuggestTileRequest,
  SuggestTileResponse as MacroSuggestTileResponse,
} from './macro/types';
import type {
  FetchMessagesRequest as SlackFetchMessagesRequest,
  FetchMessagesResponse as SlackFetchMessagesResponse,
  FetchMyReactionsRequest as SlackFetchMyReactionsRequest,
  FetchMyReactionsResponse as SlackFetchMyReactionsResponse,
  ListChannelsRequest as SlackListChannelsRequest,
  ListChannelsResponse as SlackListChannelsResponse,
  SlackTestConnectionResponse,
  SummarizeRequest as SlackSummarizeRequest,
  SummarizeResponse as SlackSummarizeResponse,
} from './slack/types';
import type {
  FindThreadMessageRequest as JiraSlackFindThreadMessageRequest,
  FindThreadMessageResponse as JiraSlackFindThreadMessageResponse,
  PreviewDailyReportResponse as JiraSlackPreviewDailyReportResponse,
  SendDailyReportResponse as JiraSlackSendDailyReportResponse,
  TestSlackConnectionRequest as JiraSlackTestConnectionRequest,
  TestSlackConnectionResponse as JiraSlackTestConnectionResponse,
} from './jira/slack-types';

export type TerminalApi = {
  create: (req: CreateTerminalRequest) => Promise<CreateTerminalResponse>;
  createForExtension: (
    req: CreateExtensionTerminalRequest,
  ) => Promise<CreateTerminalResponse>;
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
  findDuplicateSteps: (req: FindDuplicateStepsRequest) => Promise<FindDuplicateStepsResponse>;
  mergeDuplicateSteps: (req: MergeDuplicateStepsRequest) => Promise<MergeDuplicateStepsResponse>;

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
  gitStatus: (req: ListByWorkspaceRequest) => Promise<GitStatusResponse>;
  gitFileDiff: (req: GitFileDiffRequest) => Promise<GitFileDiffResponse>;
  gitStagePaths: (req: GitStagePathsRequest) => Promise<void>;
  gitUnstagePaths: (req: GitUnstagePathsRequest) => Promise<void>;
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

export type ThemeMode = 'dark' | 'light';
export type Preferences = { theme?: ThemeMode };
export type PreferencesApi = {
  getSync: () => Preferences;
  setTheme: (req: { theme: ThemeMode }) => Promise<void>;
};

export type UpdaterApi = {
  getStatus: () => Promise<UpdaterStatus>;
  check: () => Promise<UpdaterStatus>;
  quitAndInstall: () => Promise<void>;
  onStatus: (listener: (event: UpdaterStatusEvent) => void) => () => void;
};

export type ExtensionApi = {
  list: () => Promise<ExtensionListItem[]>;
  setEnabled: (req: SetEnabledRequest) => Promise<ExtensionListItem>;
  updateSettings: (req: UpdateSettingsRequest) => Promise<ExtensionListItem>;
  onChanged: (listener: (event: ExtensionsChangedEvent) => void) => () => void;
  onOpenPanel: (listener: (event: ExtensionOpenPanelEvent) => void) => () => void;
};

export type JiraApi = {
  listMyIssues: (req: ListMyIssuesRequest) => Promise<ListMyIssuesResponse>;
  testConnection: () => Promise<TestConnectionResponse>;
};

export type JiraSnapshotApi = {
  trigger: (req: JiraSnapshotTriggerRequest) => Promise<JiraSnapshotTriggerResponse>;
  getLatest: () => Promise<JiraSnapshotStored | null>;
  getMeta: () => Promise<JiraSnapshotMeta>;
  onProgress: (listener: (event: JiraSyncProgressEvent) => void) => () => void;
};

export type JiraLabelsApi = {
  getNotes: () => Promise<JiraLabelNote[]>;
  saveNotes: (req: JiraSaveLabelNotesRequest) => Promise<JiraLabelNote[]>;
  searchByLabel: (req: JiraSearchByLabelRequest) => Promise<JiraSearchByLabelResponse>;
  bulkReplace: (req: JiraBulkReplaceRequest) => Promise<JiraBulkReplaceResponse>;
  updateIssueLabels: (req: JiraUpdateIssueLabelsRequest) => Promise<void>;
  suggest: (req: JiraSuggestLabelRequest) => Promise<JiraSuggestLabelResponse>;
};

export type JiraSlackApi = {
  testConnection: (
    req?: JiraSlackTestConnectionRequest,
  ) => Promise<JiraSlackTestConnectionResponse>;
  findThreadMessage: (
    req?: JiraSlackFindThreadMessageRequest,
  ) => Promise<JiraSlackFindThreadMessageResponse>;
  sendDailyReport: () => Promise<JiraSlackSendDailyReportResponse>;
  previewDailyReport: () => Promise<JiraSlackPreviewDailyReportResponse>;
};

export type GithubPrApi = {
  listPullRequests: (req: {
    state: 'open' | 'closed' | 'all';
  }) => Promise<{
    prs: Array<{
      number: number;
      title: string;
      state: 'open' | 'closed';
      draft: boolean;
      merged: boolean;
      user: { login: string; avatarUrl: string };
      repo: string;
      headRef: string;
      htmlUrl: string;
      createdAt: string;
      updatedAt: string;
      labels: Array<{ name: string; color: string }>;
      requestedReviewers: Array<{ login: string }>;
    }>;
    errors: Array<{ repo: string; error: string }>;
    hasMore: boolean;
  }>;
  testConnection: () => Promise<{
    ok: true;
    login: string;
    apiUrl: string;
    repos: string[];
  }>;
  listRepos: () => Promise<{ repos: string[] }>;
  createReleaseBranch: (req: {
    repo: string;
    baseBranch?: string;
    targetBranch?: string;
  }) => Promise<{
    branch: string;
    prNumber: number;
    prUrl: string;
    commitCount: number;
    requestedReviewers: string[];
    reviewerWarning: string | null;
  }>;
  createReleaseTag: (req: {
    repo: string;
    branch?: string;
  }) => Promise<{
    tag: string;
    sha: string;
    releaseUrl: string;
  }>;
};

export type SlackApi = {
  listChannels: (req?: SlackListChannelsRequest) => Promise<SlackListChannelsResponse>;
  fetchMessages: (req: SlackFetchMessagesRequest) => Promise<SlackFetchMessagesResponse>;
  fetchMyReactions: (
    req: SlackFetchMyReactionsRequest,
  ) => Promise<SlackFetchMyReactionsResponse>;
  summarize: (req: SlackSummarizeRequest) => Promise<SlackSummarizeResponse>;
  testConnection: () => Promise<SlackTestConnectionResponse>;
};

export type MacroApi = {
  getState: () => Promise<MacroState>;
  saveBoard: (req: MacroSaveBoardRequest) => Promise<MacroState>;
  deleteTile: (req: MacroDeleteTileRequest) => Promise<MacroState>;
  runTile: (req: MacroRunTileRequest) => Promise<MacroRunTileResponse>;
  suggestTile: (req: MacroSuggestTileRequest) => Promise<MacroSuggestTileResponse>;
  pickPath: (req: MacroPickPathRequest) => Promise<MacroPickPathResponse>;
};

export type JiraReportsApi = {
  list: () => Promise<{ files: JiraReportMeta[] }>;
  get: (req: JiraGetReportRequest) => Promise<JiraGetReportResponse>;
  save: (req: JiraSaveReportRequest) => Promise<void>;
  delete: (req: JiraDeleteReportRequest) => Promise<void>;
  generate: (req: JiraGenerateReportRequest) => Promise<JiraGenerateReportResponse>;
};

declare global {
  interface Window {
    electronAPI: {
      terminal: TerminalApi;
      workspace: WorkspaceApi;
      workOS: WorkOSApi;
      mcp: McpApi;
      preferences: PreferencesApi;
      updater: UpdaterApi;
      extension: ExtensionApi;
      jira: JiraApi;
      jiraSnapshot: JiraSnapshotApi;
      jiraLabels: JiraLabelsApi;
      jiraReports: JiraReportsApi;
      jiraSlack: JiraSlackApi;
      githubPr: GithubPrApi;
      macro: MacroApi;
      slack: SlackApi;
    };
  }
}
