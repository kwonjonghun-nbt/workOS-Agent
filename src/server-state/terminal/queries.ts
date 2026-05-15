import { queryOptions } from '@tanstack/react-query';
import { terminalApi } from '../../api/terminal';
import { terminalKeys } from './keys';

export const terminalQueries = {
  listByWorkspace: (workspaceId: string) =>
    queryOptions({
      queryKey: terminalKeys.listByWorkspace(workspaceId),
      queryFn: () => terminalApi.list({ workspaceId }),
    }),
};
