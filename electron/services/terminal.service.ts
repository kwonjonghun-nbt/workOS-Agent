import { randomUUID } from 'node:crypto';
import { TerminalSession, defaultShell, type TerminalSize } from '../domain/terminal-session';
import type { PtyRepository } from '../repositories/pty.repo';

export type TerminalEventSink = {
  onData: (sessionId: string, data: string) => void;
  onExit: (sessionId: string, exitCode: number, signal: number | null) => void;
};

export class TerminalService {
  constructor(
    private readonly ptys: PtyRepository,
    private readonly sink: TerminalEventSink,
  ) {}

  create(size: TerminalSize): string {
    const session = new TerminalSession(randomUUID(), defaultShell(), size);
    this.ptys.spawn(session);
    this.ptys.onData(session.id, (data) => this.sink.onData(session.id, data));
    this.ptys.onExit(session.id, (code, signal) => this.sink.onExit(session.id, code, signal));
    return session.id;
  }

  write(sessionId: string, data: string): void {
    this.ptys.write(sessionId, data);
  }

  resize(sessionId: string, size: TerminalSize): void {
    this.ptys.resize(sessionId, size);
  }

  dispose(sessionId: string): void {
    this.ptys.dispose(sessionId);
  }
}
