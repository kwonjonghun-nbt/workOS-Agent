import { useEffect, useRef } from 'react';
import { Split } from '../../shared/Split';
import { TerminalList } from './TerminalList';
import { TerminalView } from './TerminalView';
import { useTerminalList } from '../../../business/terminal/use-terminal-list';
import { useWorkspaceStore } from '../../../business/workspace/workspace-store';

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

type Props = {
  workspaceId: string;
  onClose?: () => void;
};

export function TerminalPanel({ workspaceId, onClose }: Props) {
  const { terminals, isLoading, addTerminal, removeTerminal } = useTerminalList(workspaceId);

  const activeTerminalId = useWorkspaceStore(
    (s) => s.activeTerminalIdByWorkspace[workspaceId] ?? null,
  );
  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);

  // 최초 로딩이 끝났고 비어있으면 첫 터미널 자동 생성.
  // mutation 이 동시에 여러 번 발사되지 않도록 ref 가드를 둔다.
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (terminals.length > 0) {
      autoCreatedRef.current = false;
      return;
    }
    if (autoCreatedRef.current) return;
    autoCreatedRef.current = true;
    void addTerminal(DEFAULT_COLS, DEFAULT_ROWS).then((sessionId) => {
      setActiveTerminal(workspaceId, sessionId);
    });
  }, [isLoading, terminals.length, addTerminal, workspaceId, setActiveTerminal]);

  // 활성 터미널이 목록에 없으면 마지막 항목으로 폴백.
  useEffect(() => {
    if (terminals.length === 0) {
      if (activeTerminalId !== null) setActiveTerminal(workspaceId, null);
      return;
    }
    const exists = terminals.some((t) => t.sessionId === activeTerminalId);
    if (!exists) {
      setActiveTerminal(workspaceId, terminals[terminals.length - 1].sessionId);
    }
  }, [terminals, activeTerminalId, workspaceId, setActiveTerminal]);

  const handleAdd = async () => {
    const sessionId = await addTerminal(DEFAULT_COLS, DEFAULT_ROWS);
    setActiveTerminal(workspaceId, sessionId);
  };

  const handleClose = (sessionId: string) => {
    void removeTerminal(sessionId);
  };

  const listItems = terminals.map((t, i) => ({
    id: t.sessionId,
    name: `terminal${i + 1}`,
  }));

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-1.5">
        <span className="text-sm text-slate-300">Terminal Panel</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
            title="터미널 패널 닫기"
          >
            닫기
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <Split direction="horizontal" initialFirstSize={22} minFirstSize={12} maxFirstSize={50}>
          <TerminalList
            items={listItems}
            activeId={activeTerminalId}
            onSelect={(id) => setActiveTerminal(workspaceId, id)}
            onAdd={handleAdd}
            onClose={handleClose}
          />
          <div className="relative h-full w-full bg-black">
            {terminals.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                좌측 + 버튼으로 터미널을 추가하세요.
              </div>
            ) : (
              terminals.map((t) => (
                <div
                  key={t.sessionId}
                  className="absolute inset-0"
                  style={{ display: t.sessionId === activeTerminalId ? 'block' : 'none' }}
                >
                  <TerminalView
                    sessionId={t.sessionId}
                    isActive={t.sessionId === activeTerminalId}
                  />
                </div>
              ))
            )}
          </div>
        </Split>
      </div>
    </div>
  );
}
