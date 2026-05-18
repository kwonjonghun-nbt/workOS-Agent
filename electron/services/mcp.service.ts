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

export class McpService {
  private scriptPath: string;

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
  async setup(workspaceId: string, force: boolean): Promise<SetupMcpResponse> {
    const root = await this.cwd.resolveCwd(workspaceId);
    const configPath = path.join(root, MCP_CONFIG_REL);
    const sessionPath = path.join(root, SESSION_REL);
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
    const giPath = path.join(root, GITIGNORE_REL);
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

    return { status: await this.workspaceStatus(workspaceId), actions };
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
