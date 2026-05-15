export type CreateTerminalRequest = {
  cols: number;
  rows: number;
  cwd?: string;
};

export type CreateTerminalResponse = {
  sessionId: string;
};

export type WriteTerminalRequest = {
  sessionId: string;
  data: string;
};

export type ResizeTerminalRequest = {
  sessionId: string;
  cols: number;
  rows: number;
};

export type DisposeTerminalRequest = {
  sessionId: string;
};

export type TerminalDataEvent = {
  sessionId: string;
  data: string;
};

export type TerminalExitEvent = {
  sessionId: string;
  exitCode: number;
  signal: number | null;
};
