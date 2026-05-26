import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  wizardEvents,
  wizardKeys,
  wizardMutations,
  wizardQueries,
} from '../../server-state/wizard';

/**
 * 메인의 `wizard:updated` 푸시를 받아 해당 워크스페이스의 세션 쿼리를 invalidate.
 * App 루트에서 한 번만 마운트하면 충분.
 */
export function useWizardSync() {
  const qc = useQueryClient();
  useEffect(() => {
    const off = wizardEvents.subscribeUpdated((evt) => {
      qc.invalidateQueries({ queryKey: wizardKeys.session(evt.workspaceId) });
    });
    return off;
  }, [qc]);
}

export function useWizardSession(workspaceId: string) {
  return useQuery(wizardQueries.session(workspaceId));
}

export function useWizardSendMessage() {
  return useMutation(wizardMutations.sendMessage());
}
export function useWizardApproveProposal() {
  return useMutation(wizardMutations.approveProposal());
}
export function useWizardRejectProposal() {
  return useMutation(wizardMutations.rejectProposal());
}
export function useWizardProceedNext() {
  return useMutation(wizardMutations.proceedNext());
}
export function useWizardReset() {
  return useMutation(wizardMutations.reset());
}
