import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';

export type ControlPlaneHandler = (
  body: unknown,
  ctx: { workspaceId: string },
) => Promise<unknown>;

/**
 * Local HTTP control plane bound on 127.0.0.1.
 * The stdio MCP server (spawned by Claude CLI) calls these endpoints to
 * push state changes back into the Electron main process.
 *
 * Security:
 *   - 127.0.0.1 only (no external interface).
 *   - Bearer token required on every request.
 *   - Token + workspaceId rotate per app launch and per workspace.
 */
export class McpControlPlane {
  private server: Server | null = null;
  private port: number | null = null;
  private readonly token: string;
  private readonly handlers = new Map<string, ControlPlaneHandler>();

  constructor() {
    this.token = randomBytes(24).toString('base64url');
  }

  on(route: string, handler: ControlPlaneHandler): void {
    this.handlers.set(route, handler);
  }

  getToken(): string {
    return this.token;
  }

  getPort(): number | null {
    return this.port;
  }

  isRunning(): boolean {
    return this.server !== null && this.port !== null;
  }

  async start(): Promise<{ port: number; token: string }> {
    if (this.server && this.port) return { port: this.port, token: this.token };
    const server = createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        writeJson(res, 500, { error: 'INTERNAL', message: (err as Error).message });
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', reject);
        resolve();
      });
    });
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('control plane: invalid address');
    }
    this.server = server;
    this.port = addr.port;
    return { port: this.port, token: this.token };
  }

  async stop(): Promise<void> {
    const s = this.server;
    this.server = null;
    this.port = null;
    if (!s) return;
    await new Promise<void>((resolve) => s.close(() => resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET' && req.url === '/v1/health') {
      writeJson(res, 200, { ok: true });
      return;
    }
    if (req.method !== 'POST') {
      writeJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      return;
    }
    const auth = req.headers['authorization'];
    if (typeof auth !== 'string' || auth !== `Bearer ${this.token}`) {
      writeJson(res, 401, { error: 'UNAUTHORIZED' });
      return;
    }
    const workspaceId = req.headers['x-workos-workspace'];
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      writeJson(res, 400, { error: 'MISSING_WORKSPACE' });
      return;
    }
    const route = req.url ?? '';
    const handler = this.handlers.get(route);
    if (!handler) {
      writeJson(res, 404, { error: 'NOT_FOUND', route });
      return;
    }
    let body: unknown = {};
    try {
      body = await readJson(req);
    } catch (err) {
      writeJson(res, 400, { error: 'BAD_BODY', message: (err as Error).message });
      return;
    }
    try {
      const out = await handler(body, { workspaceId });
      writeJson(res, 200, { ok: true, data: out ?? null });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      writeJson(res, 400, { error: e.code ?? 'HANDLER_ERROR', message: e.message ?? String(err) });
    }
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (raw.trim().length === 0) return {};
  return JSON.parse(raw);
}
