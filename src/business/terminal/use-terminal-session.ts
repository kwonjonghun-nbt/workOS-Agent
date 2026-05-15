import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { terminalEvents, terminalMutations } from '../../server-state/terminal';

type Options = {
  sessionId: string;
  onData: (data: string) => void;
  onExit?: (exitCode: number) => void;
};

/**
 * 이미 메인에 존재하는 sessionId 에 attach 하여 데이터 스트림을 수신한다.
 * pty 생성은 use-terminal-list 의 addTerminal 에서 수행 — 이 훅은 attach 만.
 * unmount 시 pty 는 dispose 하지 않는다 (워크스페이스 백그라운드 보존).
 */
export function useTerminalSession({ sessionId, onData, onExit }: Options) {
  const writeMut = useMutation(terminalMutations.write());
  const resizeMut = useMutation(terminalMutations.resize());

  const onDataRef = useRef(onData);
  const onExitRef = useRef(onExit);
  onDataRef.current = onData;
  onExitRef.current = onExit;

  const writeMutateRef = useRef(writeMut.mutate);
  const resizeMutateRef = useRef(resizeMut.mutate);
  writeMutateRef.current = writeMut.mutate;
  resizeMutateRef.current = resizeMut.mutate;

  useEffect(() => {
    const offData = terminalEvents.subscribeData((evt) => {
      if (evt.sessionId === sessionId) onDataRef.current(evt.data);
    });
    const offExit = terminalEvents.subscribeExit((evt) => {
      if (evt.sessionId === sessionId) onExitRef.current?.(evt.exitCode);
    });
    return () => {
      offData();
      offExit();
    };
  }, [sessionId]);

  const write = useCallback(
    (data: string) => writeMutateRef.current({ sessionId, data }),
    [sessionId],
  );

  const resize = useCallback(
    (cols: number, rows: number) => resizeMutateRef.current({ sessionId, cols, rows }),
    [sessionId],
  );

  return { write, resize };
}
