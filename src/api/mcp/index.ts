import type {
  McpStatusRequest,
  McpStatusResponse,
  McpToastEvent,
  McpToolDescriptor,
  SetupMcpRequest,
  SetupMcpResponse,
  TaskItemProgressEvent,
} from './types';

export const mcpApi = {
  status: (req: McpStatusRequest): Promise<McpStatusResponse> =>
    window.electronAPI.mcp.status(req),
  setup: (req: SetupMcpRequest): Promise<SetupMcpResponse> => window.electronAPI.mcp.setup(req),
  listTools: (): Promise<McpToolDescriptor[]> => window.electronAPI.mcp.listTools(),
  onProgress: (listener: (event: TaskItemProgressEvent) => void): (() => void) =>
    window.electronAPI.mcp.onProgress(listener),
  onToast: (listener: (event: McpToastEvent) => void): (() => void) =>
    window.electronAPI.mcp.onToast(listener),
};

export type { McpStatusResponse, McpWorkspaceStatus, McpServerStatus, SetupMcpResponse, McpToolDescriptor, TaskItemProgressEvent, McpToastEvent } from './types';
