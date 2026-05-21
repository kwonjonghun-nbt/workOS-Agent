export type TerminalPurpose = 'user' | 'extension';

// Mirror of electron/contracts/workspace.ts: fixed id for the singleton system
// default workspace that hosts extension-owned terminals.
export const SYSTEM_DEFAULT_WORKSPACE_ID = '__system_default__';

export type TerminalSummary = {
  sessionId: string;
  workspaceId: string;
  cwd: string;
  shell: string;
  createdAt: number;
  name: string;
  purpose: TerminalPurpose;
  ownerExtensionId?: string;
};

export type CreateExtensionTerminalRequest = {
  extensionId: string;
  cols: number;
  rows: number;
};

export type RenameTerminalRequest = {
  sessionId: string;
  name: string;
};

export type CreateTerminalRequest = {
  workspaceId: string;
  cols: number;
  rows: number;
  purpose?: TerminalPurpose;
  ownerExtensionId?: string;
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
  purpose?: TerminalPurpose;
  ownerExtensionId?: string;
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
  ownerExtensionId?: string;
};
