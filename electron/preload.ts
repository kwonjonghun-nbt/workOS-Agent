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

contextBridge.exposeInMainWorld('electronAPI', { terminal, workspace });

export type ElectronAPI = { terminal: typeof terminal; workspace: typeof workspace };
