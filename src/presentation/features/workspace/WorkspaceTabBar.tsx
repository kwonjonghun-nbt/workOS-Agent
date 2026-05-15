import type { Workspace } from '../../../server-state/workspace';

type Props = {
  workspaces: Workspace[];
  openIds: string[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAdd: () => void;
};

export function WorkspaceTabBar({
  workspaces,
  openIds,
  activeId,
  onSelect,
  onCloseTab,
  onAdd,
}: Props) {
  const byId = new Map(workspaces.map((w) => [w.id, w]));
  const tabs = openIds.map((id) => byId.get(id)).filter((w): w is Workspace => Boolean(w));

  return (
    <div className="flex items-center border-b border-slate-700 bg-slate-950">
      <ul className="flex flex-1 items-center overflow-x-auto">
        {tabs.map((w) => (
          <li
            key={w.id}
            className={`group flex items-center gap-2 border-r border-slate-700 px-3 py-1.5 text-sm ${
              w.id === activeId
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(w.id)}
              className="max-w-[200px] truncate text-left"
              title={w.rootPath}
            >
              {w.name}
            </button>
            <button
              type="button"
              onClick={() => onCloseTab(w.id)}
              className="rounded px-1 text-slate-400 opacity-60 hover:bg-slate-700 hover:text-white group-hover:opacity-100"
              aria-label={`Close workspace tab ${w.name}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="border-l border-slate-700 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-slate-800"
        aria-label="Open folder as workspace"
      >
        + 폴더 열기
      </button>
    </div>
  );
}
