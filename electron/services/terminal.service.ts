import { randomUUID } from 'node:crypto';
import { TerminalSession, defaultShell, type TerminalSize } from '../domain/terminal-session';
import type { PtyRepository } from '../repositories/pty.repo';
import type { TerminalPurpose, TerminalSummary } from '../contracts/terminal';
import { ApiError } from '../infra/error';

export type TerminalEventSink = {
  onData: (sessionId: string, data: string) => void;
  onExit: (
    sessionId: string,
    workspaceId: string,
    exitCode: number,
    signal: number | null,
    ownerExtensionId: string | undefined,
  ) => void;
};

export type CwdResolver = {
  resolveCwd(workspaceId: string): Promise<string>;
};

export type CreateOptions = {
  purpose?: TerminalPurpose;
  ownerExtensionId?: string;
  cwdOverride?: string;
  envOverride?: Record<string, string>;
};

export class TerminalService {
  private readonly sessions = new Map<string, TerminalSession>();

  constructor(
    private readonly ptys: PtyRepository,
    private readonly sink: TerminalEventSink,
    private readonly cwdResolver: CwdResolver,
  ) {}

  async create(
    workspaceId: string,
    size: TerminalSize,
    opts: CreateOptions = {},
  ): Promise<string> {
    const purpose = opts.purpose ?? 'user';
    const cwd = opts.cwdOverride ?? (await this.cwdResolver.resolveCwd(workspaceId));
    const name = this.nextDefaultName(workspaceId, purpose);
    const session = new TerminalSession(
      randomUUID(),
      workspaceId,
      defaultShell(),
      cwd,
      size,
      Date.now(),
      name,
      purpose,
      opts.ownerExtensionId,
    );
    this.sessions.set(session.id, session);
    this.ptys.spawn(session, opts.envOverride);
    this.ptys.onData(session.id, (data) => this.sink.onData(session.id, data));
    this.ptys.onExit(session.id, (code, signal) => {
      this.sink.onExit(
        session.id,
        session.workspaceId,
        code,
        signal,
        session.ownerExtensionId,
      );
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

  private nextDefaultName(workspaceId: string, purpose: TerminalPurpose): string {
    const used = new Set<string>();
    for (const s of this.sessions.values()) {
      if (s.workspaceId === workspaceId && s.purpose === purpose) used.add(s.name);
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

  /**
   * List sessions. Defaults to user-purpose terminals (preserves existing
   * workspace UI behavior). Pass `purpose='extension'` with `ownerExtensionId`
   * to scope to a single extension's panel.
   */
  /**
   * Push synthetic data into the session's output stream — appears in the
   * extension terminal panel as if the PTY had produced it. Used by host
   * services (e.g. AI runners) to mirror external child-process output into
   * the user-visible terminal without actually executing through the PTY.
   */
  appendSessionData(sessionId: string, data: string): void {
    if (!this.sessions.has(sessionId)) return;
    this.sink.onData(sessionId, data);
  }

  /**
   * Returns the first extension-owned session for the given extension, or
   * creates one if none exists. Used by host services that want to pipe AI CLI
   * work through the visible extension terminal panel.
   */
  async ensureExtensionSession(
    workspaceId: string,
    extensionId: string,
    cwd: string,
    envOverride: Record<string, string>,
    size: TerminalSize = { cols: 120, rows: 30 },
  ): Promise<string> {
    for (const s of this.sessions.values()) {
      if (
        s.workspaceId === workspaceId &&
        s.purpose === 'extension' &&
        s.ownerExtensionId === extensionId
      ) {
        return s.id;
      }
    }
    return this.create(workspaceId, size, {
      purpose: 'extension',
      ownerExtensionId: extensionId,
      cwdOverride: cwd,
      envOverride,
    });
  }

  list(
    workspaceId: string,
    filter: { purpose?: TerminalPurpose; ownerExtensionId?: string } = {},
  ): TerminalSummary[] {
    const purpose = filter.purpose ?? 'user';
    const out: TerminalSummary[] = [];
    for (const s of this.sessions.values()) {
      if (s.workspaceId !== workspaceId) continue;
      if (s.purpose !== purpose) continue;
      if (filter.ownerExtensionId && s.ownerExtensionId !== filter.ownerExtensionId) continue;
      out.push({
        sessionId: s.id,
        workspaceId: s.workspaceId,
        cwd: s.cwd,
        shell: s.shell,
        createdAt: s.createdAt,
        name: s.name,
        purpose: s.purpose,
        ownerExtensionId: s.ownerExtensionId,
      });
    }
    out.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }
}
