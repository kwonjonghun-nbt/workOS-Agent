import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  MCP_TOOLS,
  mcpStatusRequestSchema,
  setupMcpRequestSchema,
  type McpStatusResponse,
  type McpToolDescriptor,
  type SetupMcpResponse,
} from '../contracts/mcp';
import { toApiError } from '../infra/error';
import type { McpService } from '../services/mcp.service';
import type { PreferencesService } from '../services/preferences.service';

export function registerMcpHandlers(
  svc: McpService,
  preferences: PreferencesService,
): void {
  ipcMain.handle(CHANNELS.mcp.status, async (_e, raw) => {
    try {
      const { workspaceId } = mcpStatusRequestSchema.parse(raw);
      const res: McpStatusResponse = {
        server: svc.serverStatus(),
        workspace: await svc.workspaceStatus(workspaceId),
      };
      return res;
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.mcp.setup, async (_e, raw): Promise<SetupMcpResponse> => {
    try {
      const { workspaceId, force } = setupMcpRequestSchema.parse(raw);
      return await svc.setup(workspaceId, force, {
        enabled: preferences.isSessionGateEnabled(),
        mode: preferences.getSessionGateMode(),
      });
    } catch (err) {
      throw toApiError(err);
    }
  });

  ipcMain.handle(CHANNELS.mcp.listTools, async (): Promise<McpToolDescriptor[]> => {
    return MCP_TOOLS;
  });
}
