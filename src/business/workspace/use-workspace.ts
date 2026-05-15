import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  workspaceEvents,
  workspaceKeys,
  workspaceMutations,
  workspaceQueries,
  type Workspace,
} from '../../server-state/workspace';
import { useWorkspaceStore } from './workspace-store';

/** 워크스페이스 목록 + push event 동기화. */
export function useWorkspaceList() {
  const queryClient = useQueryClient();
  const pruneMissing = useWorkspaceStore((s) => s.pruneMissing);

  const query = useQuery(workspaceQueries.list());

  useEffect(() => {
    const off = workspaceEvents.subscribeChanged((evt) => {
      queryClient.setQueryData(workspaceKeys.list(), evt.workspaces);
      pruneMissing(new Set(evt.workspaces.map((w) => w.id)));
    });
    return off;
  }, [queryClient, pruneMissing]);

  return query;
}

/** 디렉토리 다이얼로그 → add → 탭 열기 + 활성화. */
export function useAddWorkspace() {
  const openDialog = useMutation(workspaceMutations.openDialog());
  const add = useMutation(workspaceMutations.add());
  const openTab = useWorkspaceStore((s) => s.openTab);

  return async (): Promise<Workspace | null> => {
    const { path } = await openDialog.mutateAsync();
    if (!path) return null;
    const ws = await add.mutateAsync({ path });
    openTab(ws.id);
    return ws;
  };
}

/** 영구 삭제 — pty 도 main 에서 cascade dispose 됨. */
export function useRemoveWorkspace() {
  const remove = useMutation(workspaceMutations.remove());
  const closeTab = useWorkspaceStore((s) => s.closeTab);

  return async (id: string): Promise<void> => {
    await remove.mutateAsync({ id });
    closeTab(id);
  };
}

export function useRenameWorkspace() {
  const rename = useMutation(workspaceMutations.rename());
  return (id: string, name: string) => rename.mutateAsync({ id, name });
}
