import { randomUUID } from 'node:crypto';
import { TerminalSession, defaultShell, type TerminalSize } from '../domain/terminal-session';
import type { PtyRepository } from '../repositories/pty.repo';
import type { TerminalSummary } from '../contracts/terminal';
import { ApiError } from '../infra/error';

export type TerminalEventSink = {
  onData: (sessionId: string, data: string) => void;
  onExit: (sessionId: string, workspaceId: string, exitCode: number, signal: number | null) => void;
};

export type CwdResolver = {
  resolveCwd(workspaceId: string): Promise<string>;
};

export class TerminalService {
  private readonly sessions = new Map<string, TerminalSession>();

  constructor(
    private readonly ptys: PtyRepository,
    private readonly sink: TerminalEventSink,
    private readonly cwdResolver: CwdResolver,
  ) {}

  async create(workspaceId: string, size: TerminalSize): Promise<string> {
    const cwd = await this.cwdResolver.resolveCwd(workspaceId);
    const name = this.nextDefaultName(workspaceId);
    const session = new TerminalSession(
      randomUUID(),
      workspaceId,
      defaultShell(),
      cwd,
      size,
      Date.now(),
      name,
    );
    this.sessions.set(session.id, session);
    this.ptys.spawn(session);
    this.ptys.onData(session.id, (data) => this.sink.onData(session.id, data));
    this.ptys.onExit(session.id, (code, signal) => {
      this.sink.onExit(session.id, session.workspaceId, code, signal);
      this.sessions.delete(session.id);
    });
    return session.id;
  }

  write(sessionId: string, data: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new ApiError('NOT_FOUND', `terminal session not found: ${sessionId}`);
    }
    this.ptys.write(sessionId, data);
  }

  rename(sessionId: string, name: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new ApiError('NOT_FOUND', `terminal session not found: ${sessionId}`);
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ApiError('VALIDATION', 'terminal name must not be empty');
    }
    session.rename(trimmed);
  }

  private nextDefaultName(workspaceId: string): string {
    const used = new Set<string>();
    for (const s of this.sessions.values()) {
      if (s.workspaceId === workspaceId) used.add(s.name);
    }
    let n = 1;
    while (used.has(`terminal${n}`)) n += 1;
    return `terminal${n}`;
  }

  resize(sessionId: string, size: TerminalSize): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new ApiError('NOT_FOUND', `terminal session not found: ${sessionId}`);
    }
    session.resize(size);
    this.ptys.resize(sessionId, size);
  }

  dispose(sessionId: string): void {
    if (!this.sessions.has(sessionId)) return;
    this.ptys.dispose(sessionId);
    this.sessions.delete(sessionId);
  }

  disposeByWorkspace(workspaceId: string): void {
    for (const [id, s] of this.sessions) {
      if (s.workspaceId === workspaceId) {
        this.ptys.dispose(id);
        this.sessions.delete(id);
      }
    }
  }

  disposeAll(): void {
    for (const id of this.sessions.keys()) {
      this.ptys.dispose(id);
    }
    this.sessions.clear();
  }

  list(workspaceId: string): TerminalSummary[] {
    const out: TerminalSummary[] = [];
    for (const s of this.sessions.values()) {
      if (s.workspaceId === workspaceId) {
        out.push({
          sessionId: s.id,
          workspaceId: s.workspaceId,
          cwd: s.cwd,
          shell: s.shell,
          createdAt: s.createdAt,
          name: s.name,
        });
      }
    }
    out.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }
}
