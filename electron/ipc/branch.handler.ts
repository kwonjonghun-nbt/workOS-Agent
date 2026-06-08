import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  createTicketBranchRequestSchema,
  type CreateTicketBranchResponse,
} from '../contracts/branch';
import type { TicketBranchService } from '../services/ticket-branch.service';
import { toApiError } from '../infra/error';

export function registerBranchHandlers(service: TicketBranchService): void {
  ipcMain.handle(
    CHANNELS.branch.createForTicket,
    async (_e, raw): Promise<CreateTicketBranchResponse> => {
      try {
        const req = createTicketBranchRequestSchema.parse(raw);
        return await service.createForTicket(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
