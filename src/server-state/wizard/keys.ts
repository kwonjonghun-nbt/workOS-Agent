export const wizardKeys = {
  all: ['wizard'] as const,
  session: (workspaceId: string) => [...wizardKeys.all, 'session', workspaceId] as const,
};
