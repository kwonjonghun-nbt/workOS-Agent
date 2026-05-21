import { queryOptions } from '@tanstack/react-query';
import { terminalApi } from '../../api/terminal';
import { SYSTEM_DEFAULT_WORKSPACE_ID } from '../../api/terminal';
import { terminalKeys } from './keys';

export const terminalQueries = {
  listByWorkspace: (workspaceId: string) =>
    queryOptions({
      queryKey: terminalKeys.listByWorkspace(workspaceId),
      queryFn: () => terminalApi.list({ workspaceId }),
    }),
  listForExtension: (extensionId: string) =>
    queryOptions({
      queryKey: terminalKeys.listForExtension(extensionId),
      queryFn: () =>
        terminalApi.list({
          workspaceId: SYSTEM_DEFAULT_WORKSPACE_ID,
          purpose: 'extension',
          ownerExtensionId: extensionId,
        }),
    }),
};
