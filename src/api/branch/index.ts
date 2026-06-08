import type { CreateTicketBranchRequest, CreateTicketBranchResponse } from './types';

function api() {
  return window.electronAPI.branch;
}

export const branchApi = {
  createForTicket: (req: CreateTicketBranchRequest): Promise<CreateTicketBranchResponse> =>
    api().createForTicket(req),
};

export type { CreateTicketBranchRequest, CreateTicketBranchResponse } from './types';
