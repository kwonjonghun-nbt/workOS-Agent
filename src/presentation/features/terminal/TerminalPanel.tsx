import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTerminalSession } from '../../../business/terminal/use-terminal-session';

type Props = {
  label?: string;
  onClose: () => void;
};

export function TerminalPanel({ label = 'Terminal', onClose }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const session = useTerminalSession({
    onData: (data) => termRef.current?.write(data),
    onExit: () => termRef.current?.writeln('\r\n[process exited]'),
  });

  // Refs to call session methods inside effects without re-running them.
  const startRef = useRef(session.start);
  const writeRef = useRef(session.write);
  const resizeRef = useRef(session.resize);
  const disposeRef = useRef(session.dispose);
  startRef.current = session.start;
  writeRef.current = session.write;
  resizeRef.current = session.resize;
  disposeRef.current = session.dispose;

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

    void startRef.current(term.cols, term.rows);

    const onInputDisposable = term.onData((data) => writeRef.current(data));
    const onResizeDisposable = term.onResize(({ cols, rows }) => resizeRef.current(cols, rows));

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      onInputDisposable.dispose();
      onResizeDisposable.dispose();
      disposeRef.current();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-1.5">
        <span className="text-sm text-slate-300">{label}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-700"
          aria-label="Close terminal"
        >
          ✕
        </button>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-2" />
    </div>
  );
}
