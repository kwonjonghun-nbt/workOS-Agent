import { useWorkspaceStore } from '../../../business/workspace/workspace-store';
import {
  useAddWorkspace,
  useRemoveWorkspace,
  useWorkspaceList,
} from '../../../business/workspace/use-workspace';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { Split } from '../../shared/Split';
import { WorkspaceTabBar } from './WorkspaceTabBar';
import { WorkspaceContent } from './WorkspaceContent';

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
    <div className="flex h-screen w-screen flex-col bg-ink-900 text-white">
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
                <WorkspacePane workspaceId={id} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function WorkspacePane({ workspaceId }: { workspaceId: string }) {
  const terminalOpen = useWorkspaceStore(
    (s) => s.terminalPanelOpenByWorkspace[workspaceId] ?? true,
  );
  const toggleTerminalPanel = useWorkspaceStore((s) => s.toggleTerminalPanel);
  const onToggle = () => toggleTerminalPanel(workspaceId);

  if (!terminalOpen) {
    return (
      <WorkspaceContent
        workspaceId={workspaceId}
        terminalOpen={false}
        onToggleTerminal={onToggle}
      />
    );
  }
  return (
    <Split direction="horizontal" initialFirstSize={60} minFirstSize={20} maxFirstSize={85}>
      <WorkspaceContent workspaceId={workspaceId} terminalOpen onToggleTerminal={onToggle} />
      <TerminalPanel workspaceId={workspaceId} onClose={onToggle} />
    </Split>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-ink-900">
      <div className="max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-claude-500/15 text-3xl text-claude-300 shadow-soft">
          ✱
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-50">
            워크스페이스를 여세요
          </h2>
          <p className="text-sm leading-relaxed text-ink-400">
            프로젝트 폴더를 열어 Claude 에이전트와 함께 작업을 시작하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center gap-2 rounded-full bg-claude-500 px-5 py-2.5 text-sm font-medium text-white shadow-soft transition-colors hover:bg-claude-400"
        >
          <span className="text-base leading-none">＋</span>
          폴더 열기
        </button>
      </div>
    </div>
  );
}
