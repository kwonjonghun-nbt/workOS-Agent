import { queryOptions } from '@tanstack/react-query';
import { mcpApi, type McpStatusResponse, type McpToolDescriptor } from '../../api/mcp';
import { mcpKeys } from './keys';

export const mcpStatusQuery = (workspaceId: string) =>
  queryOptions<McpStatusResponse>({
    queryKey: mcpKeys.status(workspaceId),
    queryFn: () => mcpApi.status({ workspaceId }),
    enabled: Boolean(workspaceId),
    staleTime: 5_000,
  });

export const mcpToolsQuery = () =>
  queryOptions<McpToolDescriptor[]>({
    queryKey: mcpKeys.tools(),
    queryFn: () => mcpApi.listTools(),
    staleTime: Infinity,
  });
