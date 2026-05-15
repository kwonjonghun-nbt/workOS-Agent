export const terminalKeys = {
  all: ['terminal'] as const,
  listByWorkspace: (workspaceId: string) =>
    [...terminalKeys.all, 'list', workspaceId] as const,
};
