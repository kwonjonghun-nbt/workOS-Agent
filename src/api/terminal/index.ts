import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  DisposeTerminalRequest,
  ListTerminalsRequest,
  ResizeTerminalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  TerminalSummary,
  WriteTerminalRequest,
} from './types';
import type { TerminalApi } from '../electronAPI';

function api(): TerminalApi {
  return window.electronAPI.terminal;
}

export const terminalApi = {
  create: (req: CreateTerminalRequest) => api().create(req),
  write: (req: WriteTerminalRequest) => api().write(req),
  resize: (req: ResizeTerminalRequest) => api().resize(req),
  dispose: (req: DisposeTerminalRequest) => api().dispose(req),
  list: (req: ListTerminalsRequest) => api().list(req),
  onData: (listener: (event: TerminalDataEvent) => void) => api().onData(listener),
  onExit: (listener: (event: TerminalExitEvent) => void) => api().onExit(listener),
};

export type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  WriteTerminalRequest,
  ResizeTerminalRequest,
  DisposeTerminalRequest,
  ListTerminalsRequest,
  TerminalSummary,
  TerminalDataEvent,
  TerminalExitEvent,
};
