import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { TerminalSession, type TerminalSize } from '../domain/terminal-session';

export interface PtyRepository {
  spawn(session: TerminalSession, env?: Record<string, string>): void;
  write(sessionId: string, data: string): void;
  resize(sessionId: string, size: TerminalSize): void;
  dispose(sessionId: string): void;
  onData(sessionId: string, listener: (data: string) => void): void;
  onExit(sessionId: string, listener: (code: number, signal: number | null) => void): void;
}

type Handle = {
  proc: IPty;
  dataListeners: ((data: string) => void)[];
  exitListeners: ((code: number, signal: number | null) => void)[];
};

export class NodePtyRepository implements PtyRepository {
  private readonly handles = new Map<string, Handle>();

  spawn(session: TerminalSession, envOverride?: Record<string, string>): void {
    const env = envOverride
      ? { ...(process.env as Record<string, string>), ...envOverride }
      : (process.env as Record<string, string>);
    const proc = pty.spawn(session.shell, [], {
      name: 'xterm-color',
      cols: session.size.cols,
      rows: session.size.rows,
      cwd: session.cwd,
      env,
    });

    const handle: Handle = { proc, dataListeners: [], exitListeners: [] };
    this.handles.set(session.id, handle);

    proc.onData((data) => {
      for (const l of handle.dataListeners) l(data);
    });
    proc.onExit(({ exitCode, signal }) => {
      for (const l of handle.exitListeners) l(exitCode, signal ?? null);
      this.handles.delete(session.id);
    });
  }

  write(sessionId: string, data: string): void {
    this.handles.get(sessionId)?.proc.write(data);
  }

  resize(sessionId: string, size: TerminalSize): void {
    this.handles.get(sessionId)?.proc.resize(size.cols, size.rows);
  }

  dispose(sessionId: string): void {
    const h = this.handles.get(sessionId);
    if (!h) return;
    try {
      h.proc.kill();
    } catch {
      // ignore
    }
    this.handles.delete(sessionId);
  }

  onData(sessionId: string, listener: (data: string) => void): void {
    this.handles.get(sessionId)?.dataListeners.push(listener);
  }

  onExit(sessionId: string, listener: (code: number, signal: number | null) => void): void {
    this.handles.get(sessionId)?.exitListeners.push(listener);
  }
}
