// Mirror of electron/contracts/mcp.ts — types only (no runtime cross-import).

export type McpServerStatus = {
  running: boolean;
  port: number | null;
  scriptPath: string;
};

export type McpWorkspaceStatus = {
  workspaceId: string;
  configPath: string;
  sessionPath: string;
  configured: boolean;
  sessionFresh: boolean;
};

export type McpStatusRequest = { workspaceId: string };
export type McpStatusResponse = {
  server: McpServerStatus;
  workspace: McpWorkspaceStatus;
};

export type SetupMcpRequest = { workspaceId: string; force: boolean };
export type SetupMcpResponse = {
  status: McpWorkspaceStatus;
  actions: string[];
};

export type McpToolDescriptor = {
  name: string;
  title: string;
  description: string;
};

export type TaskItemProgressEvent = {
  workspaceId: string;
  taskItemId: string;
  message: string;
  at: number;
};

export type McpToastEvent = {
  workspaceId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
};
