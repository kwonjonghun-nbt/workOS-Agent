export const workOSKeys = {
  all: ['workOS'] as const,
  steps: (workspaceId: string) => [...workOSKeys.all, 'steps', workspaceId] as const,
  workflows: (workspaceId: string) => [...workOSKeys.all, 'workflows', workspaceId] as const,
  tasks: (workspaceId: string) => [...workOSKeys.all, 'tasks', workspaceId] as const,
  taskItems: (workspaceId: string) => [...workOSKeys.all, 'task-items', workspaceId] as const,
  catalog: (workspaceId: string) => [...workOSKeys.all, 'catalog', workspaceId] as const,
  gitDiff: (workspaceId: string) => [...workOSKeys.all, 'git-diff', workspaceId] as const,
  gitStatus: (workspaceId: string) => [...workOSKeys.all, 'git-status', workspaceId] as const,
  gitFileDiff: (workspaceId: string, path: string, side: 'staged' | 'unstaged') =>
    [...workOSKeys.all, 'git-file-diff', workspaceId, side, path] as const,
};
