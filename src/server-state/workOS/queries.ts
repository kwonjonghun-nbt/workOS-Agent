import { queryOptions } from '@tanstack/react-query';
import { workOSApi } from '../../api/workOS';
import { workOSKeys } from './keys';

export const workOSQueries = {
  steps: (workspaceId: string) =>
    queryOptions({
      queryKey: workOSKeys.steps(workspaceId),
      queryFn: () => workOSApi.listSteps({ workspaceId }),
      enabled: Boolean(workspaceId),
    }),
  workflows: (workspaceId: string) =>
    queryOptions({
      queryKey: workOSKeys.workflows(workspaceId),
      queryFn: () => workOSApi.listWorkflows({ workspaceId }),
      enabled: Boolean(workspaceId),
    }),
  tasks: (workspaceId: string) =>
    queryOptions({
      queryKey: workOSKeys.tasks(workspaceId),
      queryFn: () => workOSApi.listTasks({ workspaceId }),
      enabled: Boolean(workspaceId),
    }),
  taskItems: (workspaceId: string) =>
    queryOptions({
      queryKey: workOSKeys.taskItems(workspaceId),
      queryFn: () => workOSApi.listTaskItems({ workspaceId }),
      enabled: Boolean(workspaceId),
    }),
  catalog: (workspaceId: string) =>
    queryOptions({
      queryKey: workOSKeys.catalog(workspaceId),
      queryFn: () => workOSApi.catalog({ workspaceId }),
      enabled: Boolean(workspaceId),
    }),
  gitDiff: (workspaceId: string) =>
    queryOptions({
      queryKey: workOSKeys.gitDiff(workspaceId),
      queryFn: () => workOSApi.gitDiff({ workspaceId }),
      enabled: Boolean(workspaceId),
    }),
};
