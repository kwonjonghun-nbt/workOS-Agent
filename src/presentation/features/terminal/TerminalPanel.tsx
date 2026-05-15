import { useEffect, useState } from 'react';
import { Split } from '../../shared/Split';
import { TerminalList } from './TerminalList';
import { TerminalView } from './TerminalView';
import { useTerminalStore } from '../../../business/terminal/terminal-store';

// NOTE: 터미널 목록은 현재 렌더러 zustand 스토어로 관리한다.
// 렌더러가 terminal:create / dispose 를 직접 호출하므로 어떤 sessionId 가 살아있는지
// 렌더러가 SSOT 를 가진다 (메인은 pty 자체의 소유권만 가짐).
//
// 아래 상황이 생기면 메인 프로세스에 `terminal:list` IPC 채널을 도입해 받아오는 방향으로 전환한다:
//   1) 멀티 윈도우 — 한 윈도우에서 만든 세션을 다른 윈도우에서 보여줘야 할 때
//   2) 렌더러 리로드/크래시 후 살아있는 pty 세션 재연결 (recovery)
//   3) 렌더러 외부(메뉴/CLI/스케줄러 등)에서 세션을 만들거나 종료할 수 있을 때
//   4) 세션 메타데이터(cwd, 시작 시각, exit 상태 등)를 메인이 권위 있게 관리해야 할 때

type Props = {
  onClosePanel?: () => void;
};

export function TerminalPanel({ onClosePanel }: Props) {
  const terminals = useTerminalStore((s) => s.terminals);
  const addTerminal = useTerminalStore((s) => s.addTerminal);
  const removeTerminal = useTerminalStore((s) => s.removeTerminal);
  const renameTerminal = useTerminalStore((s) => s.renameTerminal);

  // 활성 탭은 UI 관심사이므로 presentation 로컬 상태로 관리.
  const [activeId, setActiveId] = useState<string | null>(null);

  // 패널이 열렸을 때 비어있으면 첫 터미널을 자동 생성.
  useEffect(() => {
    if (terminals.length === 0) {
      const id = addTerminal();
      setActiveId(id);
    }
  }, [terminals.length, addTerminal]);

  // 활성 탭이 목록에서 사라졌으면 마지막 항목으로 폴백.
  // functional setter 로 activeId 를 deps 에 넣지 않아 자기 트리거를 막는다.
  useEffect(() => {
    setActiveId((current) => {
      if (current && !terminals.some((t) => t.id === current)) {
        return terminals[terminals.length - 1]?.id ?? null;
      }
      if (!current && terminals.length > 0) {
        return terminals[terminals.length - 1].id;
      }
      return current;
    });
  }, [terminals]);

  const handleAdd = () => {
    const id = addTerminal();
    setActiveId(id);
  };

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-1.5">
        <span className="text-sm text-slate-300">Terminal Panel</span>
        {onClosePanel && (
          <button
            type="button"
            onClick={onClosePanel}
            className="rounded px-2 py-0.5 text-slate-300 hover:bg-slate-700"
            aria-label="Close terminal panel"
          >
            ✕
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <Split direction="horizontal" initialFirstSize={22} minFirstSize={12} maxFirstSize={50}>
          <TerminalList
            items={terminals}
            activeId={activeId}
            onSelect={setActiveId}
            onAdd={handleAdd}
            onClose={removeTerminal}
            onRename={renameTerminal}
          />
          <div className="relative h-full w-full bg-black">
            {terminals.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                좌측 + 버튼으로 터미널을 추가하세요.
              </div>
            ) : (
              terminals.map((t) => (
                <div
                  key={t.id}
                  className="absolute inset-0"
                  style={{ display: t.id === activeId ? 'block' : 'none' }}
                >
                  <TerminalView terminalId={t.id} isActive={t.id === activeId} />
                </div>
              ))
            )}
          </div>
        </Split>
      </div>
    </div>
  );
}
