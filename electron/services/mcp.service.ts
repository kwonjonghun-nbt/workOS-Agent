import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { McpServerStatus, McpWorkspaceStatus, SetupMcpResponse } from '../contracts/mcp';
import { ApiError } from '../infra/error';
import type { McpControlPlane } from '../infra/mcp-control-plane';

export type CwdResolver = { resolveCwd(workspaceId: string): Promise<string> };

/** Name of the MCP server entry inside the workspace .mcp.json */
const SERVER_NAME = 'workos-agent';

/** Workspace-scoped session sidecar (gitignored — port+token rotate per app launch). */
const SESSION_REL = path.join('.claude', 'workOS', '.mcp-session.json');
const MCP_CONFIG_REL = '.mcp.json';
const GITIGNORE_REL = path.join('.claude', 'workOS', '.gitignore');
/** Per-user Claude Code settings where we install the SessionStart hook. */
const CLAUDE_SETTINGS_REL = path.join('.claude', 'settings.local.json');
/** Filename used to identify our SessionStart hook entry for idempotent add/remove. */
const HOOK_SCRIPT_NAME = 'session-start-hook.mjs';
/** Claude SessionStart hook timeout (seconds) — matches the control plane long-poll. */
const HOOK_TIMEOUT_SEC = 600;

export type SessionGateSetup = {
  /**
   * Install the SessionStart Jira gate hook into this cwd's settings.local.json.
   * MUST be false for extension cwds (their headless `claude` AI runs would
   * deadlock on the blocking modal). Only user workspaces pass true.
   */
  enabled: boolean;
  /** Trigger mode baked into the hook command (`always` | `flag`). */
  mode?: 'always' | 'flag';
};

export type SetupAtOptions = {
  sessionGate?: SessionGateSetup;
};

export class McpService {
  private scriptPath: string;
  private hookScriptPath = '';

  constructor(
    private readonly cwd: CwdResolver,
    private readonly plane: McpControlPlane,
    scriptPath: string,
  ) {
    this.scriptPath = scriptPath;
  }

  setScriptPath(p: string): void {
    this.scriptPath = p;
  }

  setHookScriptPath(p: string): void {
    this.hookScriptPath = p;
  }

  /** Wait briefly until the control plane is up and the script path is set. */
  private async waitReady(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (!(this.plane.isRunning() && this.scriptPath)) {
      if (Date.now() - start > timeoutMs) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  serverStatus(): McpServerStatus {
    return {
      running: this.plane.isRunning(),
      port: this.plane.getPort(),
      scriptPath: this.scriptPath,
    };
  }

  async workspaceStatus(workspaceId: string): Promise<McpWorkspaceStatus> {
    const root = await this.cwd.resolveCwd(workspaceId);
    const configPath = path.join(root, MCP_CONFIG_REL);
    const sessionPath = path.join(root, SESSION_REL);

    const configured = await this.isConfigured(configPath);
    let sessionFresh = await this.isSessionFresh(sessionPath);

    // 포트/토큰은 매 실행마다 회전 → 사이드카는 자동 갱신해도 안전 (사용자 설정 아님, gitignore 됨).
    // configured 된 워크스페이스라면 status 조회 시 슬그머니 동기화한다.
    if (!sessionFresh && configured && this.plane.isRunning() && this.scriptPath) {
      try {
        await this.refreshSession(workspaceId, sessionPath);
        sessionFresh = await this.isSessionFresh(sessionPath);
      } catch {
        // best-effort — UI 에는 stale 로 표시되고 사용자가 수동 재설정 가능
      }
    }

    return { workspaceId, configPath, sessionPath, configured, sessionFresh };
  }

  private async refreshSession(workspaceId: string, sessionPath: string): Promise<void> {
    const port = this.plane.getPort();
    const token = this.plane.getToken();
    if (port === null) return;
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await writeJsonAtomic(sessionPath, {
      workspaceId,
      port,
      token,
      updatedAt: Date.now(),
    });
  }

  /**
   * Ensures the workspace .mcp.json registers our server, writes the
   * session sidecar with current port+token+workspaceId, and adds a
   * .gitignore entry so the sidecar is not committed.
   */
  async setup(
    workspaceId: string,
    force: boolean,
    sessionGate: SessionGateSetup = { enabled: true, mode: 'always' },
  ): Promise<SetupMcpResponse> {
    const root = await this.cwd.resolveCwd(workspaceId);
    const actions = await this.setupAt(root, workspaceId, force, { sessionGate });
    return { status: await this.workspaceStatus(workspaceId), actions };
  }

  /**
   * Write `.mcp.json` + session sidecar at an arbitrary cwd. Used by both the
   * user-facing workspace setup (above) and the extension terminal runner, so
   * extension-owned claude sessions also see workOS MCP tools.
   *
   * The `workspaceId` embedded in the session file is what the control plane
   * receives as `x-workos-workspace` on each tool call. For extension cwds
   * this should be the system-default workspace id.
   */
  async setupAt(
    cwd: string,
    workspaceId: string,
    force: boolean,
    opts: SetupAtOptions = {},
  ): Promise<string[]> {
    const configPath = path.join(cwd, MCP_CONFIG_REL);
    const sessionPath = path.join(cwd, SESSION_REL);
    const actions: string[] = [];

    await this.waitReady(3000);
    if (!this.plane.isRunning()) {
      throw new ApiError(
        'INTERNAL',
        'MCP control plane이 아직 시작되지 않았습니다. 잠시 후 다시 시도하세요.',
      );
    }
    if (!this.scriptPath) {
      throw new ApiError(
        'INTERNAL',
        'MCP 서버 스크립트가 아직 설치되지 않았습니다. 잠시 후 다시 시도하세요.',
      );
    }
    const port = this.plane.getPort()!;
    const token = this.plane.getToken();

    // 1) .mcp.json: merge or create
    const config = await readJsonOrEmpty(configPath);
    if (typeof config.mcpServers !== 'object' || config.mcpServers === null) {
      config.mcpServers = {};
    }
    const servers = config.mcpServers as Record<string, unknown>;
    const existing = servers[SERVER_NAME];
    const desired = {
      command: 'node',
      args: [this.scriptPath],
    };
    if (force || !existing || !deepEqual(existing, desired)) {
      servers[SERVER_NAME] = desired;
      await writeJsonAtomic(configPath, config);
      actions.push(existing ? `updated ${MCP_CONFIG_REL}` : `created ${MCP_CONFIG_REL}`);
    } else {
      actions.push(`${MCP_CONFIG_REL} already configured`);
    }

    // 2) sidecar session file (always rewritten — token may have rotated)
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await writeJsonAtomic(sessionPath, {
      workspaceId,
      port,
      token,
      updatedAt: Date.now(),
    });
    actions.push('refreshed .mcp-session.json');

    // 3) .gitignore for sidecar (do not commit token)
    const giPath = path.join(cwd, GITIGNORE_REL);
    try {
      let cur = '';
      try {
        cur = await fs.readFile(giPath, 'utf-8');
      } catch {
        /* ignore */
      }
      if (!cur.split('\n').some((l) => l.trim() === '.mcp-session.json')) {
        const next = (cur.endsWith('\n') || cur.length === 0 ? cur : cur + '\n') +
          '# workOS-Agent MCP session — contains a localhost auth token, do not commit\n.mcp-session.json\n';
        await fs.writeFile(giPath, next, 'utf-8');
        actions.push(`added .gitignore entry for sidecar`);
      }
    } catch {
      // best-effort
    }

    // 4) SessionStart Jira gate hook in .claude/settings.local.json
    try {
      const enabled = opts.sessionGate?.enabled === true && this.hookScriptPath !== '';
      const mode = opts.sessionGate?.mode ?? 'always';
      const action = await this.syncSessionGateHook(cwd, enabled, mode);
      if (action) actions.push(action);
    } catch (err) {
      // best-effort — gate hook is non-critical; never block MCP setup.
      actions.push(`session gate hook skipped: ${(err as Error).message}`);
    }

    return actions;
  }

  /**
   * Add or remove our SessionStart hook entry in `<cwd>/.claude/settings.local.json`.
   * Idempotent: identified by the hook command containing {@link HOOK_SCRIPT_NAME}.
   * Other hooks/settings in the file are preserved. `mode` is baked into the
   * command as `--mode=<mode>` so the hook knows its trigger semantics.
   */
  private async syncSessionGateHook(
    cwd: string,
    enabled: boolean,
    mode: 'always' | 'flag',
  ): Promise<string | null> {
    const settingsPath = path.join(cwd, CLAUDE_SETTINGS_REL);
    const settings = await readJsonOrEmpty(settingsPath);

    const hooks =
      typeof settings.hooks === 'object' && settings.hooks !== null
        ? (settings.hooks as Record<string, unknown>)
        : {};
    const sessionStart = Array.isArray(hooks.SessionStart)
      ? (hooks.SessionStart as Array<Record<string, unknown>>)
      : [];

    const isOurs = (entry: Record<string, unknown>): boolean => {
      const inner = Array.isArray(entry.hooks) ? entry.hooks : [];
      return inner.some(
        (h) =>
          h &&
          typeof h === 'object' &&
          typeof (h as { command?: unknown }).command === 'string' &&
          ((h as { command: string }).command).includes(HOOK_SCRIPT_NAME),
      );
    };

    const others = sessionStart.filter((e) => !isOurs(e));
    const hadOurs = others.length !== sessionStart.length;

    if (!enabled) {
      if (!hadOurs) return null; // nothing to remove
      if (others.length > 0) hooks.SessionStart = others;
      else delete hooks.SessionStart;
      if (Object.keys(hooks).length > 0) settings.hooks = hooks;
      else delete settings.hooks;
      await writeJsonAtomic(settingsPath, settings);
      return `removed SessionStart gate hook from ${CLAUDE_SETTINGS_REL}`;
    }

    const desired = {
      matcher: 'startup',
      hooks: [
        {
          type: 'command',
          command: `node ${JSON.stringify(this.hookScriptPath)} --mode=${mode}`,
          timeout: HOOK_TIMEOUT_SEC,
        },
      ],
    };
    hooks.SessionStart = [...others, desired];
    settings.hooks = hooks;
    await writeJsonAtomic(settingsPath, settings);
    return hadOurs
      ? `updated SessionStart gate hook in ${CLAUDE_SETTINGS_REL}`
      : `installed SessionStart gate hook in ${CLAUDE_SETTINGS_REL}`;
  }

  isReady(): boolean {
    return this.plane.isRunning() && Boolean(this.scriptPath);
  }

  private async isConfigured(configPath: string): Promise<boolean> {
    const cfg = await readJsonOrEmpty(configPath);
    const servers = cfg.mcpServers;
    if (typeof servers !== 'object' || servers === null) return false;
    const entry = (servers as Record<string, unknown>)[SERVER_NAME] as
      | { command?: unknown; args?: unknown }
      | undefined;
    return Boolean(entry && entry.command === 'node' && Array.isArray(entry.args));
  }

  private async isSessionFresh(sessionPath: string): Promise<boolean> {
    try {
      const raw = await fs.readFile(sessionPath, 'utf-8');
      const parsed = JSON.parse(raw) as { port?: unknown; token?: unknown };
      return (
        typeof parsed.port === 'number' &&
        parsed.port === this.plane.getPort() &&
        typeof parsed.token === 'string' &&
        parsed.token === this.plane.getToken()
      );
    } catch {
      return false;
    }
  }
}

async function readJsonOrEmpty(file: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  await fs.rename(tmp, file);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
