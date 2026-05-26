import type {
  WizardApproveProposalRequest,
  WizardGetRequest,
  WizardProceedNextRequest,
  WizardRejectProposalRequest,
  WizardResetRequest,
  WizardSendMessageRequest,
  WizardSession,
  WizardUpdatedEvent,
} from './types';

function api() {
  return window.electronAPI.wizard;
}

export const wizardApi = {
  get: (req: WizardGetRequest) => api().get(req),
  sendMessage: (req: WizardSendMessageRequest) => api().sendMessage(req),
  approveProposal: (req: WizardApproveProposalRequest) => api().approveProposal(req),
  rejectProposal: (req: WizardRejectProposalRequest) => api().rejectProposal(req),
  proceedNext: (req: WizardProceedNextRequest) => api().proceedNext(req),
  reset: (req: WizardResetRequest) => api().reset(req),
  onUpdated: (listener: (e: WizardUpdatedEvent) => void) => api().onUpdated(listener),
};

export type {
  WizardSession,
  WizardGetRequest,
  WizardSendMessageRequest,
  WizardApproveProposalRequest,
  WizardRejectProposalRequest,
  WizardProceedNextRequest,
  WizardResetRequest,
  WizardUpdatedEvent,
};
export type {
  WizardMessage,
  WizardMessageRole,
  WizardAction,
  WizardPhase,
  WizardProposal,
} from './types';
