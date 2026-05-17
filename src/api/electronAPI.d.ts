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

declare global {
  interface Window {
    electronAPI: {
      terminal: TerminalApi;
      workspace: WorkspaceApi;
    };
  }
}
