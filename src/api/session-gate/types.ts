// Type-only mirrors of electron/contracts/session-gate.ts.

export type SessionGateChoice = 'create' | 'select' | 'skip';

export type SessionGateIssue = {
  key: string;
  summary: string;
  url: string;
};

export type SessionGateResolveRequest =
  | { requestId: string; choice: 'create'; issue: SessionGateIssue }
  | { requestId: string; choice: 'select'; issue: SessionGateIssue }
  | { requestId: string; choice: 'skip' };

export type SessionGateResolveResponse = {
  accepted: boolean;
};

export type SessionGateOpenEvent = {
  requestId: string;
  workspaceId: string;
  cwd: string;
  source: string;
};

export type SessionGateCloseEvent = {
  requestId: string;
};
