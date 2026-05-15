import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTerminalSession } from '../../../business/terminal/use-terminal-session';
import { useTerminalStore } from '../../../business/terminal/terminal-store';

type Props = {
  terminalId: string;
  isActive: boolean;
};

export function TerminalView({ terminalId, isActive }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const setSessionId = useTerminalStore((s) => s.setSessionId);

  const session = useTerminalSession({
    onData: (data) => termRef.current?.write(data),
    onExit: () => termRef.current?.writeln('\r\n[process exited]'),
    onSessionCreated: (sessionId) => setSessionId(terminalId, sessionId),
  });

  const startRef = useRef(session.start);
  const writeRef = useRef(session.write);
  const resizeRef = useRef(session.resize);
  const disposeRef = useRef(session.dispose);
  startRef.current = session.start;
  writeRef.current = session.write;
  resizeRef.current = session.resize;
  disposeRef.current = session.dispose;

  // xterm 인스턴스는 마운트 1회만 생성한다.
  // terminalId 가 deps 에 없는 것은 안전한가? — TerminalPanel 이 `key={t.id}` 로 렌더하므로
  // terminalId 가 바뀔 일이 없다(다른 id 면 별개 컴포넌트로 unmount→mount). 의도된 빈 deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // fit() 은 컨테이너가 분리되었거나 측정 불가일 때 throw — 무시해도 안전.
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

  // 비활성 → 활성 전환 시 display:none 에서 풀리는 순간 ResizeObserver 가 트리거되지 않으므로 수동 refit.
  useEffect(() => {
    if (!isActive) return;
    requestAnimationFrame(() => {
      try {
        fitRef.current?.fit();
        termRef.current?.focus();
      } catch {
        // fit() 은 컨테이너가 분리되었거나 측정 불가일 때 throw — 무시해도 안전.
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
