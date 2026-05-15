import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { CHANNELS } from './contracts/channels';
import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  DisposeTerminalRequest,
  ResizeTerminalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  WriteTerminalRequest,
} from './contracts/terminal';

const terminal = {
  create: (req: CreateTerminalRequest): Promise<CreateTerminalResponse> =>
    ipcRenderer.invoke(CHANNELS.terminal.create, req),
  write: (req: WriteTerminalRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.terminal.write, req),
  resize: (req: ResizeTerminalRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.terminal.resize, req),
  dispose: (req: DisposeTerminalRequest): Promise<void> =>
    ipcRenderer.invoke(CHANNELS.terminal.dispose, req),
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

contextBridge.exposeInMainWorld('electronAPI', { terminal });

export type ElectronAPI = { terminal: typeof terminal };
