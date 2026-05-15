import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTerminalSession } from '../../../business/terminal/use-terminal-session';

type Props = {
  sessionId: string;
  isActive: boolean;
};

export function TerminalView({ sessionId, isActive }: Props) {
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

  // TerminalPanel 이 `key={sessionId}` 로 마운트하므로 deps 비움이 안전.
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

    // 마운트 시점의 cols/rows 를 메인에 동기화 (pty 는 create 시 사이즈로 시작했지만
    // 컨테이너 측정 결과가 다를 수 있으므로 fit 후 한 번 resize 통보).
    resizeRef.current(term.cols, term.rows);

    const onInputDisposable = term.onData((data) => writeRef.current(data));
    const onResizeDisposable = term.onResize(({ cols, rows }) => resizeRef.current(cols, rows));

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // 컨테이너가 분리되었거나 측정 불가일 때 throw — 무시.
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      onInputDisposable.dispose();
      onResizeDisposable.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // 비활성→활성 전환 시 수동 refit + focus.
  useEffect(() => {
    if (!isActive) return;
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        termRef.current?.focus();
      } catch {
        // ignore
      }
    });
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden p-2"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  );
}
