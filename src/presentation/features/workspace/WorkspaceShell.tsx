import { useWorkspaceStore } from '../../../business/workspace/workspace-store';
import {
  useAddWorkspace,
  useRemoveWorkspace,
  useWorkspaceList,
} from '../../../business/workspace/use-workspace';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { WorkspaceTabBar } from './WorkspaceTabBar';

export function WorkspaceShell() {
  const listQuery = useWorkspaceList();
  const workspaces = listQuery.data ?? [];

  const openIds = useWorkspaceStore((s) => s.openIds);
  const activeId = useWorkspaceStore((s) => s.activeId);
  const setActive = useWorkspaceStore((s) => s.setActive);

  const addWorkspace = useAddWorkspace();
  const removeWorkspace = useRemoveWorkspace();

  const handleAdd = () => {
    void addWorkspace();
  };

  const handleCloseTab = (id: string) => {
    const ws = workspaces.find((w) => w.id === id);
    const label = ws ? `'${ws.name}'` : '이 워크스페이스';
    if (
      window.confirm(
        `${label} 를 삭제하시겠습니까?\n실행 중인 터미널도 모두 종료되며 되돌릴 수 없습니다.`,
      )
    ) {
      void removeWorkspace(id);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-900 text-white">
      <WorkspaceTabBar
        workspaces={workspaces}
        openIds={openIds}
        activeId={activeId}
        onSelect={setActive}
        onCloseTab={handleCloseTab}
        onAdd={handleAdd}
      />
      <div className="relative min-h-0 flex-1">
        {openIds.length === 0 ? (
          <EmptyState onOpen={handleAdd} />
        ) : (
          openIds.map((id) => {
            const ws = workspaces.find((w) => w.id === id);
            if (!ws) return null;
            return (
              <div
                key={id}
                className="absolute inset-0"
                style={{ display: id === activeId ? 'block' : 'none' }}
              >
                <TerminalPanel workspaceId={id} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-semibold">워크스페이스를 여세요</h2>
        <p className="text-slate-400">디렉토리를 선택해 작업을 시작합니다.</p>
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md bg-emerald-500 px-4 py-2 font-medium text-slate-900 hover:bg-emerald-400"
        >
          폴더 열기
        </button>
      </div>
    </div>
  );
}
