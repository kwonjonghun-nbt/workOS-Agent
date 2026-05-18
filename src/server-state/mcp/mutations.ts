import type { QueryClient } from '@tanstack/react-query';
import { mcpApi, type SetupMcpResponse } from '../../api/mcp';
import { mcpKeys } from './keys';

export const mcpSetupMutation = (qc: QueryClient) => ({
  mutationFn: (vars: { workspaceId: string; force?: boolean }): Promise<SetupMcpResponse> =>
    mcpApi.setup({ workspaceId: vars.workspaceId, force: vars.force ?? false }),
  onSuccess: (_data: SetupMcpResponse, vars: { workspaceId: string }) => {
    qc.invalidateQueries({ queryKey: mcpKeys.status(vars.workspaceId) });
  },
});
