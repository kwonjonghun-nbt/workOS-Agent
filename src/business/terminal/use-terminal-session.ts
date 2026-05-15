import { useCallback, useEffect, useRef, useState } from 'react';
import { terminalApi } from '../../api/terminal';

type Status = 'idle' | 'starting' | 'running' | 'exited';

type Options = {
  onData: (data: string) => void;
  onExit?: (exitCode: number) => void;
};

export function useTerminalSession({ onData, onExit }: Options) {
  const [status, setStatus] = useState<Status>('idle');
  const sessionIdRef = useRef<string | null>(null);

  // listener registration uses the latest callbacks via refs
  const onDataRef = useRef(onData);
  const onExitRef = useRef(onExit);
  onDataRef.current = onData;
  onExitRef.current = onExit;

  useEffect(() => {
    const offData = terminalApi.onData((evt) => {
      if (evt.sessionId === sessionIdRef.current) onDataRef.current(evt.data);
    });
    const offExit = terminalApi.onExit((evt) => {
      if (evt.sessionId === sessionIdRef.current) {
        setStatus('exited');
        onExitRef.current?.(evt.exitCode);
      }
    });
    return () => {
      offData();
      offExit();
    };
  }, []);

  const start = useCallback(async (cols: number, rows: number) => {
    if (sessionIdRef.current) return;
    setStatus('starting');
    const { sessionId } = await terminalApi.create({ cols, rows });
    sessionIdRef.current = sessionId;
    setStatus('running');
  }, []);

  const write = useCallback((data: string) => {
    const id = sessionIdRef.current;
    if (!id) return;
    void terminalApi.write({ sessionId: id, data });
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    const id = sessionIdRef.current;
    if (!id) return;
    void terminalApi.resize({ sessionId: id, cols, rows });
  }, []);

  const dispose = useCallback(() => {
    const id = sessionIdRef.current;
    if (!id) return;
    void terminalApi.dispose({ sessionId: id });
    sessionIdRef.current = null;
    setStatus('idle');
  }, []);

  return { status, start, write, resize, dispose };
}
