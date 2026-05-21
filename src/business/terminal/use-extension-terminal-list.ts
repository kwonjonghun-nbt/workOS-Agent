import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  terminalEvents,
  terminalKeys,
  terminalMutations,
  terminalQueries,
  type TerminalSummary,
} from '../../server-state/terminal';
import { terminalApi } from '../../api/terminal';

/**
 * Extension-owned terminals. Mirrors `useTerminalList` but scoped to a single
 * extension via the system-default workspace + ownerExtensionId filter. The
 * main process owns cwd (per-extension subdir) and env (extension secrets);
 * the renderer only passes extensionId on create.
 */
export function useExtensionTerminalList(extensionId: string) {
  const queryClient = useQueryClient();
  const listKey = terminalKeys.listForExtension(extensionId);

  const listQuery = useQuery(terminalQueries.listForExtension(extensionId));

  const disposeMut = useMutation(terminalMutations.dispose());
  const renameMut = useMutation(terminalMutations.rename());

  useEffect(() => {
    const off = terminalEvents.subscribeExit((evt) => {
      if (evt.ownerExtensionId !== extensionId) return;
      queryClient.setQueryData<TerminalSummary[] | undefined>(listKey, (prev) =>
        prev?.filter((t) => t.sessionId !== evt.sessionId),
      );
    });
    return off;
  }, [queryClient, listKey, extensionId]);

  const addTerminal = async (cols: number, rows: number): Promise<string> => {
    const { sessionId } = await terminalApi.createForExtension({
      extensionId,
      cols,
      rows,
    });
    await queryClient.invalidateQueries({ queryKey: listKey });
    return sessionId;
  };

  const removeTerminal = async (sessionId: string): Promise<void> => {
    await disposeMut.mutateAsync({ sessionId });
    queryClient.setQueryData<TerminalSummary[] | undefined>(listKey, (prev) =>
      prev?.filter((t) => t.sessionId !== sessionId),
    );
  };

  const renameTerminal = async (sessionId: string, name: string): Promise<void> => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    await renameMut.mutateAsync({ sessionId, name: trimmed });
    queryClient.setQueryData<TerminalSummary[] | undefined>(listKey, (prev) =>
      prev?.map((t) => (t.sessionId === sessionId ? { ...t, name: trimmed } : t)),
    );
  };

  return {
    terminals: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    addTerminal,
    removeTerminal,
    renameTerminal,
  };
}
