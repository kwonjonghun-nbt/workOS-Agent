import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  terminalEvents,
  terminalKeys,
  terminalMutations,
  terminalQueries,
  type TerminalSummary,
} from '../../server-state/terminal';

/**
 * 워크스페이스 단위 터미널 목록 + 라이프사이클.
 * 메인 프로세스가 SSOT (sessions Map) — 여기는 그 캐시(react-query) 위에 use-case 만 얹는다.
 */
export function useTerminalList(workspaceId: string) {
  const queryClient = useQueryClient();
  const listKey = terminalKeys.listByWorkspace(workspaceId);

  const listQuery = useQuery(terminalQueries.listByWorkspace(workspaceId));

  const createMut = useMutation(terminalMutations.create());
  const disposeMut = useMutation(terminalMutations.dispose());

  useEffect(() => {
    const off = terminalEvents.subscribeExit((evt) => {
      if (evt.workspaceId !== workspaceId) return;
      queryClient.setQueryData<TerminalSummary[] | undefined>(listKey, (prev) =>
        prev?.filter((t) => t.sessionId !== evt.sessionId),
      );
    });
    return off;
  }, [queryClient, listKey, workspaceId]);

  const addTerminal = async (cols: number, rows: number): Promise<string> => {
    const { sessionId } = await createMut.mutateAsync({ workspaceId, cols, rows });
    await queryClient.invalidateQueries({ queryKey: listKey });
    return sessionId;
  };

  const removeTerminal = async (sessionId: string): Promise<void> => {
    await disposeMut.mutateAsync({ sessionId });
    queryClient.setQueryData<TerminalSummary[] | undefined>(listKey, (prev) =>
      prev?.filter((t) => t.sessionId !== sessionId),
    );
  };

  return {
    terminals: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    addTerminal,
    removeTerminal,
  };
}
