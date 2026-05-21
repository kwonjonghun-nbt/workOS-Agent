import { useEffect, useRef } from 'react';
import { Split } from '../../shared/Split';
import { TerminalList } from '../terminal/TerminalList';
import { TerminalView } from '../terminal/TerminalView';
import { useExtensionTerminalList } from '../../../business/terminal/use-extension-terminal-list';
import { useExtensionStore } from '../../../business/extension/extension-store';

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

/**
 * Multi-tab terminal panel for an extension. Mirrors the workspace
 * `TerminalPanel` but uses the extension-scoped list (system default workspace
 * + ownerExtensionId filter) and the `terminal:createForExtension` channel so
 * cwd / env injection are owned by the host.
 */
export function ExtensionTerminalPanel({
  extensionId,
  onClose,
}: {
  extensionId: string;
  onClose?: () => void;
}) {
  const { terminals, isLoading, addTerminal, removeTerminal, renameTerminal } =
    useExtensionTerminalList(extensionId);

  const activeTerminalId = useExtensionStore(
    (s) => s.activeTerminalIdByExtension[extensionId] ?? null,
  );
  const setActiveTerminal = useExtensionStore((s) => s.setActiveTerminal);

  // 최초 로딩이 끝났고 목록이 비어있으면 첫 터미널 자동 생성.
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
      setActiveTerminal(extensionId, sessionId);
    });
  }, [isLoading, terminals.length, addTerminal, extensionId, setActiveTerminal]);

  useEffect(() => {
    if (terminals.length === 0) {
      if (activeTerminalId !== null) setActiveTerminal(extensionId, null);
      return;
    }
    const exists = terminals.some((t) => t.sessionId === activeTerminalId);
    if (!exists) {
      setActiveTerminal(extensionId, terminals[terminals.length - 1].sessionId);
    }
  }, [terminals, activeTerminalId, extensionId, setActiveTerminal]);

  const handleAdd = async () => {
    const sessionId = await addTerminal(DEFAULT_COLS, DEFAULT_ROWS);
    setActiveTerminal(extensionId, sessionId);
  };

  const handleClose = (sessionId: string) => {
    void removeTerminal(sessionId);
  };

  const handleRename = (sessionId: string, name: string) => {
    void renameTerminal(sessionId, name);
  };

  const listItems = terminals.map((t) => ({ id: t.sessionId, name: t.name }));

  return (
    <div className="flex h-full w-full flex-col bg-ink-950">
      <div className="flex h-10 items-center justify-between border-b border-ink-800 bg-ink-900/80 px-3 backdrop-blur">
        <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-claude-400" />
          AI Terminal
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-ink-850 hover:text-white"
            title="터미널 패널 닫기"
          >
            닫기 ✕
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <Split direction="horizontal" initialFirstSize={22} minFirstSize={12} maxFirstSize={50}>
          <TerminalList
            items={listItems}
            activeId={activeTerminalId}
            onSelect={(id) => setActiveTerminal(extensionId, id)}
            onAdd={handleAdd}
            onClose={handleClose}
            onRename={handleRename}
          />
          <div className="relative h-full w-full bg-black">
            {terminals.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-500">
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
