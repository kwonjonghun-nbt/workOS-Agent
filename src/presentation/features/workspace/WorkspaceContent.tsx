type Props = {
  workspaceId: string;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
};

export function WorkspaceContent({ workspaceId, terminalOpen, onToggleTerminal }: Props) {
  return (
    <div className="flex h-full w-full flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-3 py-1.5">
        <span className="text-sm text-slate-300">Workspace</span>
        <button
          type="button"
          onClick={onToggleTerminal}
          className="rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-700"
          title={terminalOpen ? '터미널 패널 닫기' : '터미널 패널 열기'}
        >
          {terminalOpen ? '터미널 닫기' : '터미널 열기'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-slate-500">
        컨텐츠 영역 (workspace: {workspaceId})
      </div>
    </div>
  );
}
