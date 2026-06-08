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
import type {
  ExtensionListItem,
  ExtensionsChangedEvent,
} from '../contracts/extension';
import type { Workspace } from '../domain/workspace';
import { NodePtyRepository } from '../repositories/pty.repo';
import { JsonWorkspaceRepository } from '../repositories/workspace.repo';
import { JsonPreferencesRepository } from '../repositories/preferences.repo';
import { JsonLocalStoreRepository } from '../repositories/local-store.repo';
import { JsonExtensionStateRepository } from '../repositories/extension.repo';
import { BUILTIN_EXTENSIONS } from '../builtin-extensions';
import { TerminalService } from '../services/terminal.service';
import { WorkspaceService } from '../services/workspace.service';
import { WorkOSService } from '../services/workOS.service';
import { McpService } from '../services/mcp.service';
import { PreferencesService } from '../services/preferences.service';
import { LocalStoreService } from '../services/local-store.service';
import { ExtensionService } from '../services/extension.service';
import { ExtensionLlmRuntime } from '../services/extension-llm-runtime';
import { SessionGateRuntime } from '../services/session-gate-runtime';
import { SessionGateService } from '../services/session-gate.service';
import { registerSessionGateHandlers } from './session-gate.handler';
import { SESSION_GATE_ROUTE } from '../contracts/session-gate';
import { eventBus } from '../infra/event-bus';
import { McpControlPlane } from '../infra/mcp-control-plane';
import { registerTerminalHandlers } from './terminal.handler';
import { registerWorkspaceHandlers } from './workspace.handler';
import { registerWorkOSHandlers } from './workOS.handler';
import { registerMcpHandlers } from './mcp.handler';
import { registerPreferencesHandlers } from './preferences.handler';
import { registerLocalStoreHandlers } from './local-store.handler';
import { registerUpdaterHandlers } from './updater.handler';
import { registerExtensionHandlers } from './extension.handler';
import { HttpJiraRepository } from '../repositories/jira.repo';
import { JsonJiraSnapshotRepository } from '../repositories/jira-snapshot.repo';
import { JiraService } from '../services/jira.service';
import { JiraSnapshotService } from '../services/jira-snapshot.service';
import { JiraSchedulerService } from '../services/jira-scheduler.service';
import { registerJiraHandlers } from './jira.handler';
import { registerJiraSnapshotHandlers } from './jira-snapshot.handler';
import { registerJiraLabelHandlers } from './jira-label.handler';
import { registerJiraReportHandlers } from './jira-report.handler';
import { registerJiraSlackHandlers } from './jira-slack.handler';
import { HttpGitHubPrRepository } from '../repositories/github-pr.repo';
import { GitHubPrService } from '../services/github-pr.service';
import { registerGitHubPrHandlers } from './github-pr.handler';
import { JsonMacroRepository } from '../repositories/macro.repo';
import { MacroService } from '../services/macro.service';
import { registerMacroHandlers } from './macro.handler';
import { SlackService } from '../services/slack.service';
import { SlackSummarizeService } from '../services/slack-summarize.service';
import { SlackThreadsService } from '../services/slack-threads.service';
import { registerSlackHandlers } from './slack.handler';
import { registerSlackThreadHandlers } from './slack-threads.handler';
import { HttpSlackRepository } from '../repositories/slack.repo';
import { FsSlackThreadsRepository } from '../repositories/slack-threads.repo';
import { JiraSlackService } from '../services/jira-slack.service';
import { JiraSlackSchedulerService } from '../services/jira-slack-scheduler.service';
import { JsonLabelNotesRepository } from '../repositories/jira-label-notes.repo';
import { TerminalLlmRepository } from '../repositories/terminal-llm.repo';
import { FsReportsRepository } from '../repositories/jira-reports.repo';
import { JiraLabelService } from '../services/jira-label.service';
import { JiraReportService } from '../services/jira-report.service';
import { JsonTicketTemplateRepository } from '../repositories/jira-ticket-template.repo';
import { JiraTicketTemplateService } from '../services/jira-ticket-template.service';
import { JiraTicketReviewService } from '../services/jira-ticket-review.service';
import { registerJiraTicketTemplateHandlers } from './jira-ticket-template.handler';
import { registerJiraTicketReviewHandlers } from './jira-ticket-review.handler';
import type { SyncProgressEvent } from '../contracts/jira-snapshot';

export type Container = {
  workspaceService: WorkspaceService;
  terminalService: TerminalService;
  workOSService: WorkOSService;
  mcpService: McpService;
  mcpControlPlane: McpControlPlane;
  preferencesService: PreferencesService;
  extensionService: ExtensionService;
  extensionLlmRuntime: ExtensionLlmRuntime;
  sessionGateRuntime: SessionGateRuntime;
};

/** 사용자가 모달에서 선택할 때까지 SessionStart 훅을 막아두는 최대 시간(10분). */
const SESSION_GATE_TIMEOUT_MS = 10 * 60 * 1000;

export function registerIpcHandlers(): Container {
  const ptyRepo = new NodePtyRepository();
  const workspaceRepo = new JsonWorkspaceRepository(app.getPath('userData'));
  const preferencesRepo = new JsonPreferencesRepository(app.getPath('userData'));
  const preferencesService = new PreferencesService(preferencesRepo);
  const localStoreRepo = new JsonLocalStoreRepository(app.getPath('userData'));
  const localStoreService = new LocalStoreService(localStoreRepo);
  const extensionStateRepo = new JsonExtensionStateRepository(app.getPath('userData'));
  const extensionService = new ExtensionService(
    BUILTIN_EXTENSIONS,
    extensionStateRepo,
    {
      notify(notice) {
        // Surface extension notifications as toasts via the existing MCP toast
        // channel — the renderer already wires this into the toast store.
        const payload: McpToastEvent = {
          workspaceId: '',
          level: notice.level,
          message: `[${notice.extensionName}] ${notice.message}`,
        };
        eventBus.broadcast(CHANNELS.mcpEvents.toast, payload);
      },
    },
    (list: ExtensionListItem[]) => {
      const payload: ExtensionsChangedEvent = { extensions: list };
      eventBus.broadcast(CHANNELS.extensionEvents.changed, payload);
    },
  );

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
      onExit(sessionId, workspaceId, exitCode, signal, ownerExtensionId) {
        const payload: TerminalExitEvent = {
          sessionId,
          workspaceId,
          exitCode,
          signal,
          ownerExtensionId,
        };
        eventBus.broadcast(CHANNELS.terminalEvents.exit, payload);
        void extensionService
          .dispatchEvent('terminal:exit', {
            sessionId,
            workspaceId,
            exitCode,
            signal,
            ownerExtensionId,
          })
          .catch((err) => {
            console.error('[workos-agent] extension dispatch failed:', err);
          });
      },
    },
    { resolveCwd: (id) => workspaceService.resolveCwd(id) },
  );
  terminalServiceHolder = terminalService;

  // Bootstrap the singleton system-default workspace. Hidden from list() but
  // serves as the cwd anchor for extension-owned CLI terminals.
  void workspaceService
    .ensureSystemDefault(path.join(app.getPath('userData'), 'default-workspace'))
    .catch((err) => {
      console.error('[workos-agent] ensureSystemDefault failed:', err);
    });

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
  registerTerminalHandlers(terminalService, {
    workspace: workspaceService,
    extension: extensionService,
  });
  registerWorkOSHandlers(workOSService);

  registerMcpHandlers(mcpService, preferencesService);
  registerPreferencesHandlers(preferencesService);
  registerLocalStoreHandlers(localStoreService);
  registerUpdaterHandlers();
  registerExtensionHandlers(extensionService);

  const jiraRepo = new HttpJiraRepository();
  const jiraService = new JiraService(jiraRepo, extensionService);
  registerJiraHandlers(jiraService);

  const githubPrRepo = new HttpGitHubPrRepository();
  const githubPrService = new GitHubPrService(githubPrRepo, extensionService);
  registerGitHubPrHandlers(githubPrService);

  // Shared extension AI runtime — used by both Jira and Macro Buttons. Holds
  // pending requestId → Promise so claude's `workos_extension_llm_result`
  // MCP callback can resolve the awaiting call.
  const extensionLlmRuntime = new ExtensionLlmRuntime();

  // Session-Start Jira Gate. The SessionStart hook long-polls the control plane
  // route; this runtime holds the pending Promise until the renderer modal
  // resolves the user's create/select/skip choice.
  const sessionGateRuntime = new SessionGateRuntime();
  const sessionGateService = new SessionGateService(
    sessionGateRuntime,
    {
      open: (evt) => eventBus.broadcast(CHANNELS.sessionGateEvents.open, evt),
      close: (requestId) =>
        eventBus.broadcast(CHANNELS.sessionGateEvents.close, { requestId }),
    },
    SESSION_GATE_TIMEOUT_MS,
  );
  registerSessionGateHandlers(sessionGateService);

  // The macro extension shares the same terminal-AI plumbing as the Jira
  // extension — claude --dangerously-skip-permissions in the extension's
  // visible PTY, result via `workos_extension_llm_result` MCP callback.
  const macroLlmRepo = new TerminalLlmRepository(
    'workos.macro-buttons',
    terminalService,
    workspaceService,
    extensionService,
    mcpService,
    extensionLlmRuntime,
  );
  const macroRepo = new JsonMacroRepository(app.getPath('userData'));
  const macroService = new MacroService(
    macroRepo,
    extensionService,
    terminalService,
    workspaceService,
    macroLlmRepo,
  );
  registerMacroHandlers(macroService);

  const jiraSnapshotRepo = new JsonJiraSnapshotRepository(app.getPath('userData'));
  const jiraSnapshotService = new JiraSnapshotService(
    jiraSnapshotRepo,
    jiraRepo,
    extensionService,
    {
      emit(event: SyncProgressEvent) {
        eventBus.broadcast(CHANNELS.jiraSnapshotEvents.progress, event);
      },
    },
  );
  registerJiraSnapshotHandlers(jiraSnapshotService);
  const jiraScheduler = new JiraSchedulerService(jiraSnapshotService);
  jiraScheduler.start();

  const slackRepo = new HttpSlackRepository();
  const jiraSlackService = new JiraSlackService(
    jiraSnapshotRepo,
    slackRepo,
    extensionService,
  );
  registerJiraSlackHandlers(jiraSlackService);
  const jiraSlackScheduler = new JiraSlackSchedulerService(jiraSlackService);
  jiraSlackScheduler.start();

  const labelNotesRepo = new JsonLabelNotesRepository(app.getPath('userData'));
  // Jira 의 AI 호출(라벨 추천, 리포트 생성)은 모두 Jira 확장의 가시 터미널
  // 패널에서 claude --dangerously-skip-permissions 으로 실행되고, 결과는
  // 확장이 workos_extension_llm_result MCP 도구로 콜백한다.
  const jiraLlmRepo = new TerminalLlmRepository(
    'workos.jira',
    terminalService,
    workspaceService,
    extensionService,
    mcpService,
    extensionLlmRuntime,
  );
  const jiraLabelService = new JiraLabelService(
    labelNotesRepo,
    jiraRepo,
    jiraLlmRepo,
    extensionService,
  );
  registerJiraLabelHandlers(jiraLabelService);

  const reportsRepo = new FsReportsRepository(app.getPath('userData'));
  const jiraReportService = new JiraReportService(
    reportsRepo,
    jiraSnapshotRepo,
    labelNotesRepo,
    jiraLlmRepo,
  );
  registerJiraReportHandlers(jiraReportService);

  const ticketTemplateRepo = new JsonTicketTemplateRepository(app.getPath('userData'));
  const jiraTicketTemplateService = new JiraTicketTemplateService(ticketTemplateRepo);
  registerJiraTicketTemplateHandlers(jiraTicketTemplateService);
  const jiraTicketReviewService = new JiraTicketReviewService(
    jiraRepo,
    ticketTemplateRepo,
    jiraLlmRepo,
    extensionService,
  );
  registerJiraTicketReviewHandlers(jiraTicketReviewService);

  // ----- Slack Digest extension -----
  const slackService = new SlackService(slackRepo, extensionService);
  const slackLlmRepo = new TerminalLlmRepository(
    'workos.slack',
    terminalService,
    workspaceService,
    extensionService,
    mcpService,
    extensionLlmRuntime,
    // Slack 요약은 매 실행마다 결과를 히스토리에 누적하므로 새 터미널 세션을 만든다.
    true,
  );
  const slackSummarize = new SlackSummarizeService(slackService, slackLlmRepo);
  registerSlackHandlers(slackService, slackSummarize);

  const slackThreadsRepo = new FsSlackThreadsRepository(app.getPath('userData'));
  const slackThreadsService = new SlackThreadsService(
    slackService,
    slackRepo,
    slackThreadsRepo,
  );
  registerSlackThreadHandlers(slackThreadsService);

  void bootstrapMcp(plane, mcpService, workOSService);

  // Route for the new MCP tool `workos_extension_llm_result`.
  plane.on('/v1/extension/llm-result', async (body) => {
    const payload = body as { requestId?: unknown; content?: unknown; error?: unknown };
    const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
    if (!requestId) {
      throw new Error('requestId is required');
    }
    return extensionLlmRuntime.submit(requestId, {
      content: typeof payload.content === 'string' ? payload.content : undefined,
      error: typeof payload.error === 'string' ? payload.error : undefined,
    });
  });

  // Route for the SessionStart hook. Blocks (long-poll) until the renderer
  // modal resolves; on timeout the promise rejects → the hook fails open.
  plane.on(SESSION_GATE_ROUTE, async (body, ctx) => {
    const b = body as { cwd?: unknown; source?: unknown };
    return sessionGateService.beginGate({
      workspaceId: ctx.workspaceId,
      cwd: typeof b.cwd === 'string' ? b.cwd : '',
      source: typeof b.source === 'string' ? b.source : 'startup',
    });
  });

  return {
    workspaceService,
    terminalService,
    workOSService,
    mcpService,
    mcpControlPlane: plane,
    preferencesService,
    extensionService,
    extensionLlmRuntime,
    sessionGateRuntime,
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
    const scriptPath = await installBundledScript('workos-mcp-server.mjs');
    mcpService.setScriptPath(scriptPath);
    console.log(`[workos-agent] MCP server script installed at ${scriptPath}`);
  } catch (err) {
    console.error('[workos-agent] MCP script install failed:', err);
  }
  try {
    const hookPath = await installBundledScript('session-start-hook.mjs');
    mcpService.setHookScriptPath(hookPath);
    console.log(`[workos-agent] SessionStart hook script installed at ${hookPath}`);
  } catch (err) {
    console.error('[workos-agent] SessionStart hook script install failed:', err);
  }
}

/**
 * Install a pre-bundled (esbuild) script from `dist-electron/mcp/<name>` to a
 * stable path under userData. The scripts have all deps inlined, so we just
 * copy them out — no import rewriting. Used for both the MCP server and the
 * SessionStart hook.
 */
async function installBundledScript(name: string): Promise<string> {
  const target = path.join(app.getPath('userData'), 'mcp', name);
  const appPath = app.getAppPath();
  const cwd = process.cwd();
  const candidates = Array.from(
    new Set([
      path.join(moduleDir, 'mcp', name),
      path.join(appPath, 'dist-electron', 'mcp', name),
      path.join(cwd, 'dist-electron', 'mcp', name),
    ]),
  );
  await fs.mkdir(path.dirname(target), { recursive: true });
  let src: string | null = null;
  const tried: string[] = [];
  for (const c of candidates) {
    tried.push(c);
    try {
      src = await fs.readFile(c, 'utf-8');
      break;
    } catch {
      // try next
    }
  }
  if (!src) {
    throw new Error(
      `workOS-Agent: bundled script "${name}" not found in any of:\n  ` + tried.join('\n  '),
    );
  }
  await fs.writeFile(target, src, 'utf-8');
  try {
    await fs.chmod(target, 0o755);
  } catch {
    // ignore on platforms without chmod semantics
  }
  return target;
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
    '/v1/taskitem/run-next',
    wrap(async (ws, { taskItemId }: { taskItemId: string }) =>
      svc.mcpRunNext(ws, taskItemId),
    ),
  );
  plane.on(
    '/v1/taskitem/add',
    wrap(
      async (
        ws,
        {
          taskItemId,
          items,
        }: {
          taskItemId: string;
          items: Array<{
            stepId?: string;
            name: string;
            description?: string;
            agentName: string;
            prompt?: string;
          }>;
        },
      ) => svc.mcpAddTaskItems(ws, taskItemId, items),
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
