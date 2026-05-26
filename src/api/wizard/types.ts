// electron/contracts/wizard.ts 의 type-only 미러. 런타임 코드 공유 금지.

export type WizardMessageRole = 'user' | 'assistant' | 'system';

export type WizardAction =
  | { kind: 'approve-proposal' }
  | { kind: 'reject-proposal' }
  | { kind: 'proceed-next' }
  | { kind: 'show-progress' }
  | { kind: 'reset' }
  | { kind: 'open-task'; taskId: string };

export type WizardMessage = {
  id: string;
  role: WizardMessageRole;
  text: string;
  at: number;
  actions?: WizardAction[];
  meta?: Record<string, unknown>;
};

export type WizardPhase =
  | 'idle'
  | 'gathering'
  | 'proposing'
  | 'executing'
  | 'reviewing'
  | 'done';

export type WizardProposal = {
  workflowId: string;
  workflowName: string;
  title: string;
  requirement: string;
  reasoning?: string;
};

export type WizardSession = {
  workspaceId: string;
  phase: WizardPhase;
  messages: WizardMessage[];
  currentTaskId?: string;
  currentItemId?: string;
  pendingProposal?: WizardProposal;
  createdAt: number;
  updatedAt: number;
};

export type WizardGetRequest = { workspaceId: string };
export type WizardSendMessageRequest = { workspaceId: string; text: string };
export type WizardApproveProposalRequest = { workspaceId: string };
export type WizardRejectProposalRequest = { workspaceId: string };
export type WizardProceedNextRequest = { workspaceId: string };
export type WizardResetRequest = { workspaceId: string };

export type WizardUpdatedEvent = { workspaceId: string };
