import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { terminalApi } from '../../../api/terminal';
import { useTerminalSession } from '../../../business/terminal/use-terminal-session';

/**
 * Embedded xterm for an extension view. The host creates an extension-owned
 * terminal session on mount (workspace = system default, cwd = per-extension
 * subdir, env = extension secrets). The session is disposed on unmount so the
 * PTY doesn't outlive the view — long-running CLI work should stay open in
 * the panel while in use.
 */
export function ExtensionTerminal({
  extensionId,
  title,
}: {
  extensionId: string;
  title?: string;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create the session once per mount. We capture cols/rows from a probe term
  // synchronously after mount via the resize callback inside useTerminalSession.
  useEffect(() => {
    let cancelled = false;
    let createdId: string | null = null;
    (async () => {
      try {
        const { sessionId: id } = await terminalApi.createForExtension({
          extensionId,
          cols: 80,
          rows: 24,
        });
        if (cancelled) {
          void terminalApi.dispose({ sessionId: id });
          return;
        }
        createdId = id;
        setSessionId(id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
      if (createdId) void terminalApi.dispose({ sessionId: createdId });
    };
  }, [extensionId]);

  if (error) {
    return (
      <div className="p-4 text-xs text-rose-300">
        터미널을 시작하지 못했습니다: {error}
      </div>
    );
  }
  if (!sessionId) {
    return (
      <div className="p-4 text-xs text-ink-400">터미널을 준비 중입니다…</div>
    );
  }
  return <ExtensionTerminalView sessionId={sessionId} title={title} />;
}

function ExtensionTerminalView({
  sessionId,
  title,
}: {
  sessionId: string;
  title?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const session = useTerminalSession({
    sessionId,
    onData: (data) => termRef.current?.write(data),
    onExit: () => termRef.current?.writeln('\r\n[process exited]'),
  });
  const writeRef = useRef(session.write);
  const resizeRef = useRef(session.resize);
  writeRef.current = session.write;
  resizeRef.current = session.resize;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: { background: '#000000' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;
    resizeRef.current(term.cols, term.rows);

    const offInput = term.onData((data) => writeRef.current(data));
    const offResize = term.onResize(({ cols, rows }) => resizeRef.current(cols, rows));

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // container detached — ignore
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      offInput.dispose();
      offResize.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  return (
    <div className="flex h-full min-h-[280px] flex-col bg-black">
      {title ? (
        <div className="flex h-8 shrink-0 items-center border-b border-ink-800 bg-ink-900/80 px-3 text-[11px] uppercase tracking-wide text-ink-400">
          {title}
        </div>
      ) : null}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-2" />
    </div>
  );
}
