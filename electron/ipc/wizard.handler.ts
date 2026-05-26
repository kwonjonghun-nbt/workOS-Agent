import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  wizardApproveProposalRequestSchema,
  wizardGetRequestSchema,
  wizardProceedNextRequestSchema,
  wizardRejectProposalRequestSchema,
  wizardResetRequestSchema,
  wizardSendMessageRequestSchema,
} from '../contracts/wizard';
import { toApiError } from '../infra/error';
import type { WizardService } from '../services/wizard.service';

export function registerWizardHandlers(service: WizardService): void {
  const wrap =
    <T,>(fn: () => Promise<T>): Promise<T> =>
    fn().catch((err) => {
      throw toApiError(err);
    });

  ipcMain.handle(CHANNELS.wizard.get, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = wizardGetRequestSchema.parse(raw);
      return service.get(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.wizard.sendMessage, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId, text } = wizardSendMessageRequestSchema.parse(raw);
      return service.sendMessage(workspaceId, text);
    }),
  );
  ipcMain.handle(CHANNELS.wizard.approveProposal, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = wizardApproveProposalRequestSchema.parse(raw);
      return service.approveProposal(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.wizard.rejectProposal, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = wizardRejectProposalRequestSchema.parse(raw);
      return service.rejectProposal(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.wizard.proceedNext, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = wizardProceedNextRequestSchema.parse(raw);
      return service.proceedNext(workspaceId);
    }),
  );
  ipcMain.handle(CHANNELS.wizard.reset, async (_e, raw) =>
    wrap(async () => {
      const { workspaceId } = wizardResetRequestSchema.parse(raw);
      return service.reset(workspaceId);
    }),
  );
}
