import { mutationOptions } from '@tanstack/react-query';
import { wizardApi } from '../../api/wizard';
import type {
  WizardApproveProposalRequest,
  WizardProceedNextRequest,
  WizardRejectProposalRequest,
  WizardResetRequest,
  WizardSendMessageRequest,
  WizardSession,
} from '../../api/wizard';

// 캐시 invalidate 는 wizard:updated push event 를 events.ts 가 받아 처리한다.

export const wizardMutations = {
  sendMessage: () =>
    mutationOptions<WizardSession, Error, WizardSendMessageRequest>({
      mutationFn: (r) => wizardApi.sendMessage(r),
    }),
  approveProposal: () =>
    mutationOptions<WizardSession, Error, WizardApproveProposalRequest>({
      mutationFn: (r) => wizardApi.approveProposal(r),
    }),
  rejectProposal: () =>
    mutationOptions<WizardSession, Error, WizardRejectProposalRequest>({
      mutationFn: (r) => wizardApi.rejectProposal(r),
    }),
  proceedNext: () =>
    mutationOptions<WizardSession, Error, WizardProceedNextRequest>({
      mutationFn: (r) => wizardApi.proceedNext(r),
    }),
  reset: () =>
    mutationOptions<WizardSession, Error, WizardResetRequest>({
      mutationFn: (r) => wizardApi.reset(r),
    }),
};
