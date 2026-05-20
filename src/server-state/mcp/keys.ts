export const mcpKeys = {
  all: ['mcp'] as const,
  status: (workspaceId: string) => [...mcpKeys.all, 'status', workspaceId] as const,
  tools: () => [...mcpKeys.all, 'tools'] as const,
};
