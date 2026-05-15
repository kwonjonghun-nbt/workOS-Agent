import type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  DisposeTerminalRequest,
  ResizeTerminalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
  WriteTerminalRequest,
} from './types';

type TerminalApi = {
  create: (req: CreateTerminalRequest) => Promise<CreateTerminalResponse>;
  write: (req: WriteTerminalRequest) => Promise<void>;
  resize: (req: ResizeTerminalRequest) => Promise<void>;
  dispose: (req: DisposeTerminalRequest) => Promise<void>;
  onData: (listener: (event: TerminalDataEvent) => void) => () => void;
  onExit: (listener: (event: TerminalExitEvent) => void) => () => void;
};

declare global {
  interface Window {
    electronAPI: { terminal: TerminalApi };
  }
}

function api(): TerminalApi {
  return window.electronAPI.terminal;
}

export const terminalApi = {
  create: (req: CreateTerminalRequest) => api().create(req),
  write: (req: WriteTerminalRequest) => api().write(req),
  resize: (req: ResizeTerminalRequest) => api().resize(req),
  dispose: (req: DisposeTerminalRequest) => api().dispose(req),
  onData: (listener: (event: TerminalDataEvent) => void) => api().onData(listener),
  onExit: (listener: (event: TerminalExitEvent) => void) => api().onExit(listener),
};

export type {
  CreateTerminalRequest,
  CreateTerminalResponse,
  WriteTerminalRequest,
  ResizeTerminalRequest,
  DisposeTerminalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
};
