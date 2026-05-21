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
} from './types';
export { SYSTEM_DEFAULT_WORKSPACE_ID } from './types';
import type { TerminalApi } from '../electronAPI';

function api(): TerminalApi {
  return window.electronAPI.terminal;
}

export const terminalApi = {
  create: (req: CreateTerminalRequest) => api().create(req),
  createForExtension: (req: CreateExtensionTerminalRequest) =>
    api().createForExtension(req),
  write: (req: WriteTerminalRequest) => api().write(req),
  resize: (req: ResizeTerminalRequest) => api().resize(req),
  dispose: (req: DisposeTerminalRequest) => api().dispose(req),
  rename: (req: RenameTerminalRequest) => api().rename(req),
  list: (req: ListTerminalsRequest) => api().list(req),
  onData: (listener: (event: TerminalDataEvent) => void) => api().onData(listener),
  onExit: (listener: (event: TerminalExitEvent) => void) => api().onExit(listener),
};

export type {
  CreateExtensionTerminalRequest,
  CreateTerminalRequest,
  CreateTerminalResponse,
  WriteTerminalRequest,
  ResizeTerminalRequest,
  DisposeTerminalRequest,
  ListTerminalsRequest,
  RenameTerminalRequest,
  TerminalSummary,
  TerminalDataEvent,
  TerminalExitEvent,
};
