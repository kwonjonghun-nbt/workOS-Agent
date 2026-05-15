import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { terminalEvents, terminalMutations } from '../../server-state/terminal';

type Status = 'idle' | 'starting' | 'running' | 'exited';

type Options = {
  onData: (data: string) => void;
  onExit?: (exitCode: number) => void;
  onSessionCreated?: (sessionId: string) => void;
};

export function useTerminalSession({ onData, onExit, onSessionCreated }: Options) {
  const [status, setStatus] = useState<Status>('idle');
  const sessionIdRef = useRef<string | null>(null);

  const createMut = useMutation(terminalMutations.create());
  const writeMut = useMutation(terminalMutations.write());
  const resizeMut = useMutation(terminalMutations.resize());
  const disposeMut = useMutation(terminalMutations.dispose());

  // listener registration uses the latest callbacks via refs
  const onDataRef = useRef(onData);
  const onExitRef = useRef(onExit);
  const onSessionCreatedRef = useRef(onSessionCreated);
  onDataRef.current = onData;
  onExitRef.current = onExit;
  onSessionCreatedRef.current = onSessionCreated;

  useEffect(() => {
    const offData = terminalEvents.subscribeData((evt) => {
      if (evt.sessionId === sessionIdRef.current) onDataRef.current(evt.data);
    });
    const offExit = terminalEvents.subscribeExit((evt) => {
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

  const createMutateRef = useRef(createMut.mutateAsync);
  const writeMutateRef = useRef(writeMut.mutate);
  const resizeMutateRef = useRef(resizeMut.mutate);
  const disposeMutateRef = useRef(disposeMut.mutate);
  createMutateRef.current = createMut.mutateAsync;
  writeMutateRef.current = writeMut.mutate;
  resizeMutateRef.current = resizeMut.mutate;
  disposeMutateRef.current = disposeMut.mutate;

  const start = useCallback(async (cols: number, rows: number) => {
    if (sessionIdRef.current) return;
    setStatus('starting');
    const { sessionId } = await createMutateRef.current({ cols, rows });
    sessionIdRef.current = sessionId;
    setStatus('running');
    onSessionCreatedRef.current?.(sessionId);
  }, []);

  const write = useCallback((data: string) => {
    const id = sessionIdRef.current;
    if (!id) return;
    writeMutateRef.current({ sessionId: id, data });
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    const id = sessionIdRef.current;
    if (!id) return;
    resizeMutateRef.current({ sessionId: id, cols, rows });
  }, []);

  const dispose = useCallback(() => {
    const id = sessionIdRef.current;
    if (!id) return;
    disposeMutateRef.current({ sessionId: id });
    sessionIdRef.current = null;
    setStatus('idle');
  }, []);

  return { status, start, write, resize, dispose };
}
