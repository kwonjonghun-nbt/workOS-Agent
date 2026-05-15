export type TerminalSummary = {
  sessionId: string;
  workspaceId: string;
  cwd: string;
  shell: string;
  createdAt: number;
};

export type CreateTerminalRequest = {
  workspaceId: string;
  cols: number;
  rows: number;
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

export type ListTerminalsRequest = {
  workspaceId: string;
};

export type TerminalDataEvent = {
  sessionId: string;
  data: string;
};

export type TerminalExitEvent = {
  sessionId: string;
  workspaceId: string;
  exitCode: number;
  signal: number | null;
};
