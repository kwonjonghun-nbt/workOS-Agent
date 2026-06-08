// Type-only mirror of electron/contracts/branch.ts (런타임 코드 공유 금지).

export type CreateTicketBranchRequest = {
  workspaceId: string;
  ticketKey: string;
  summary?: string;
  issueTypeName?: string;
  baseBranch?: string;
};

export type CreateTicketBranchResponse = {
  created: boolean;
  branchName: string | null;
  skippedReason: 'bug' | 'epic' | null;
};
