import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
import { CHANNELS } from '../contracts/channels';
import type { TerminalDataEvent, TerminalExitEvent } from '../contracts/terminal';
import type {
  TaskItemProgressEvent,
  WorkOSChangedEvent,
} from '../contracts/workOS';
import type { McpToastEvent } from '../contracts/mcp';
import type { Workspace } from '../domain/workspace';
import { NodePtyRepository } from '../repositories/pty.repo';
import { JsonWorkspaceRepository } from '../repositories/workspace.repo';
import { JsonPreferencesRepository } from '../repositories/preferences.repo';
import { TerminalService } from '../services/terminal.service';
import { WorkspaceService } from '../services/workspace.service';
import { WorkOSService } from '../services/workOS.service';
import { McpService } from '../services/mcp.service';
import { PreferencesService } from '../services/preferences.service';
import { eventBus } from '../infra/event-bus';
import { McpControlPlane } from '../infra/mcp-control-plane';
import { registerTerminalHandlers } from './terminal.handler';
import { registerWorkspaceHandlers } from './workspace.handler';
import { registerWorkOSHandlers } from './workOS.handler';
import { registerMcpHandlers } from './mcp.handler';
import { registerPreferencesHandlers } from './preferences.handler';

export type Container = {
  workspaceService: WorkspaceService;
  terminalService: TerminalService;
  workOSService: WorkOSService;
  mcpService: McpService;
  mcpControlPlane: McpControlPlane;
  preferencesService: PreferencesService;
};

export function registerIpcHandlers(): Container {
  const ptyRepo = new NodePtyRepository();
  const workspaceRepo = new JsonWorkspaceRepository(app.getPath('userData'));
  const preferencesRepo = new JsonPreferencesRepository(app.getPath('userData'));
  const preferencesService = new PreferencesService(preferencesRepo);

  let terminalServiceHolder: TerminalService | null = null;

  const workspaceService = new WorkspaceService(
    workspaceRepo,
    {
      disposeByWorkspace(id) {
        terminalServiceHolder?.disposeByWorkspace(id);
      },
    },
    (list: Workspace[]) => {
      eventBus.broadcast(CHANNELS.workspaceEvents.changed, { workspaces: list });
    },
  );

  const terminalService = new TerminalService(
    ptyRepo,
    {
      onData(sessionId, data) {
        const payload: TerminalDataEvent = { sessionId, data };
        eventBus.broadcast(CHANNELS.terminalEvents.data, payload);
      },
      onExit(sessionId, workspaceId, exitCode, signal) {
        const payload: TerminalExitEvent = { sessionId, workspaceId, exitCode, signal };
        eventBus.broadcast(CHANNELS.terminalEvents.exit, payload);
      },
    },
    { resolveCwd: (id) => workspaceService.resolveCwd(id) },
  );
  terminalServiceHolder = terminalService;

  const workOSService = new WorkOSService(
    { resolveCwd: (id) => workspaceService.resolveCwd(id) },
    terminalService,
    {
      notify(workspaceId, kinds) {
        const payload: WorkOSChangedEvent = { workspaceId, kinds };
        eventBus.broadcast(CHANNELS.workOSEvents.changed, payload);
      },
    },
    {
      emit(workspaceId, taskItemId, message) {
        const payload: TaskItemProgressEvent = {
          workspaceId,
          taskItemId,
          message,
          at: Date.now(),
        };
        eventBus.broadcast(CHANNELS.mcpEvents.progress, payload);
      },
    },
  );

  // -------- MCP control plane (initialized lazily; do not block IPC setup) --
  const plane = new McpControlPlane();
  const mcpService = new McpService(
    { resolveCwd: (id) => workspaceService.resolveCwd(id) },
    plane,
    // scriptPath is filled in once installation succeeds; the service surfaces
    // it via serverStatus(). Until then, status reports running=false.
    '',
  );

  // Register every handler synchronously so the renderer can hit them as soon
  // as the BrowserWindow loads. The MCP plane bootstrap runs in the background.
  registerWorkspaceHandlers(workspaceService);
  registerTerminalHandlers(terminalService);
  registerWorkOSHandlers(workOSService);
  registerMcpHandlers(mcpService);
  registerPreferencesHandlers(preferencesService);

  void bootstrapMcp(plane, mcpService, workOSService);

  return {
    workspaceService,
    terminalService,
    workOSService,
    mcpService,
    mcpControlPlane: plane,
    preferencesService,
  };
}

async function bootstrapMcp(
  plane: McpControlPlane,
  mcpService: McpService,
  workOSService: WorkOSService,
): Promise<void> {
  // Bind routes + start the plane FIRST so `mcp:setup` works even before the
  // script install completes (file I/O can be slow on first launch / locked FS).
  bindControlPlane(plane, workOSService);
  try {
    await plane.start();
    console.log(
      `[workos-agent] MCP control plane listening on 127.0.0.1:${plane.getPort()}`,
    );
  } catch (err) {
    console.error('[workos-agent] MCP control plane failed to start:', err);
    return;
  }
  try {
    const scriptPath = await installMcpServerScript();
    mcpService.setScriptPath(scriptPath);
    console.log(`[workos-agent] MCP server script installed at ${scriptPath}`);
  } catch (err) {
    console.error('[workos-agent] MCP script install failed:', err);
  }
}

/**
 * Install the standalone MCP server script to a stable path under userData.
 * Source candidate paths cover dev (raw `electron/mcp/`) and packaged builds.
 */
async function installMcpServerScript(): Promise<string> {
  const target = path.join(app.getPath('userData'), 'mcp', 'workos-mcp-server.mjs');
  const appPath = app.getAppPath();
  const cwd = process.cwd();
  const candidates = Array.from(
    new Set([
      path.join(appPath, 'electron', 'mcp', 'workos-mcp-server.mjs'),
      path.join(appPath, 'dist-electron', 'mcp', 'workos-mcp-server.mjs'),
      path.join(moduleDir, 'mcp', 'workos-mcp-server.mjs'),
      path.join(moduleDir, '..', 'electron', 'mcp', 'workos-mcp-server.mjs'),
      path.join(cwd, 'electron', 'mcp', 'workos-mcp-server.mjs'),
    ]),
  );
  await fs.mkdir(path.dirname(target), { recursive: true });
  let src: string | null = null;
  let resolvedRoot: string | null = null;
  const tried: string[] = [];
  for (const c of candidates) {
    tried.push(c);
    try {
      src = await fs.readFile(c, 'utf-8');
      resolvedRoot = await findUp(path.dirname(c), 'node_modules');
      break;
    } catch {
      // try next
    }
  }
  if (!src) {
    throw new Error(
      'workOS-Agent: bundled MCP server script not found in any of:\n  ' + tried.join('\n  '),
    );
  }
  if (!resolvedRoot) {
    throw new Error(
      'workOS-Agent: could not locate node_modules from MCP source candidate path',
    );
  }
  // Rewrite SDK import paths to absolute node_modules so the script runs
  // regardless of cwd / packaging — Claude CLI spawns `node <abs path>`.
  const sdkBase = path.join(resolvedRoot, '@modelcontextprotocol', 'sdk', 'dist', 'esm');
  const rewritten = src.replace(
    /from '@modelcontextprotocol\/sdk\/([^']+)'/g,
    (_m, sub) => `from '${path.join(sdkBase, sub).replace(/\\/g, '/')}'`,
  );
  await fs.writeFile(target, rewritten, 'utf-8');
  try {
    await fs.chmod(target, 0o755);
  } catch {
    // ignore on platforms without chmod semantics
  }
  return target;
}

/** Walk up from `start` looking for a directory named `name`. */
async function findUp(start: string, name: string): Promise<string | null> {
  let dir = path.resolve(start);
  while (true) {
    const candidate = path.join(dir, name);
    try {
      const st = await fs.stat(candidate);
      if (st.isDirectory()) return candidate;
    } catch {
      // continue
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function bindControlPlane(plane: McpControlPlane, svc: WorkOSService): void {
  const wrap =
    <Req, Res>(fn: (workspaceId: string, body: Req) => Promise<Res>) =>
    async (body: unknown, ctx: { workspaceId: string }) =>
      fn(ctx.workspaceId, body as Req);

  plane.on('/v1/taskitem/get', wrap(async (ws, { taskItemId }: { taskItemId: string }) =>
    svc.mcpGetTaskItem(ws, taskItemId),
  ));
  plane.on(
    '/v1/taskitem/progress',
    wrap(async (ws, { taskItemId, message }: { taskItemId: string; message: string }) => {
      await svc.mcpProgress(ws, taskItemId, message);
      return { ok: true };
    }),
  );
  plane.on(
    '/v1/taskitem/complete',
    wrap(
      async (
        ws,
        {
          taskItemId,
          output,
          artifactPath,
        }: { taskItemId: string; output?: string; artifactPath?: string },
      ) => svc.mcpComplete(ws, taskItemId, output, artifactPath),
    ),
  );
  plane.on(
    '/v1/taskitem/fail',
    wrap(async (ws, { taskItemId, error }: { taskItemId: string; error: string }) =>
      svc.mcpFail(ws, taskItemId, error),
    ),
  );
  plane.on(
    '/v1/task/context',
    wrap(async (ws, { taskItemId }: { taskItemId: string }) =>
      svc.mcpTaskContext(ws, taskItemId),
    ),
  );
  plane.on(
    '/v1/decomposition/submit',
    wrap(
      async (
        ws,
        {
          taskId,
          items,
        }: {
          taskId: string;
          items: Array<{
            stepId: string;
            name: string;
            description?: string;
            agentName: string;
            prompt?: string;
          }>;
        },
      ) =>
        svc.mcpSubmitDecomposition(
          ws,
          taskId,
          items.map((i) => ({
            stepId: i.stepId,
            name: i.name,
            description: i.description ?? '',
            agentName: i.agentName,
            prompt: i.prompt ?? '',
          })),
        ),
    ),
  );
  plane.on(
    '/v1/workflow-draft/submit',
    wrap(
      async (
        ws,
        {
          draftId,
          name,
          description,
          steps,
        }: {
          draftId: string;
          name: string;
          description?: string;
          steps: Array<{ name: string; description?: string; agentName: string }>;
        },
      ) => svc.mcpSubmitWorkflowDraft(ws, draftId, name, description ?? '', steps),
    ),
  );
  plane.on(
    '/v1/catalog/list',
    wrap(async (ws) => svc.catalog(ws)),
  );
  plane.on(
    '/v1/notify',
    wrap(async (ws, { level, message }: { level: 'info' | 'warn' | 'error'; message: string }) => {
      const payload: McpToastEvent = { workspaceId: ws, level, message };
      eventBus.broadcast(CHANNELS.mcpEvents.toast, payload);
      return { ok: true };
    }),
  );
}
