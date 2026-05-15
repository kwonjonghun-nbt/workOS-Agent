type TerminalListItem = {
  id: string;
  name: string;
};

type Props = {
  items: TerminalListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
};

export function TerminalList({ items, activeId, onSelect, onAdd, onClose }: Props) {
  return (
    <div className="flex h-full w-full flex-col bg-slate-900">
      <div className="border-b border-slate-700 p-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm font-medium text-emerald-400 hover:border-emerald-500/50 hover:bg-slate-700"
          aria-label="Add terminal"
        >
          <span className="text-base leading-none">+</span>
          <span>새 터미널</span>
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {items.map((item) => (
          <li key={item.id}>
            <div
              className={`group flex items-center justify-between px-3 py-1.5 text-sm ${
                item.id === activeId
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className="flex-1 truncate text-left"
              >
                {item.name}
              </button>
              <button
                type="button"
                onClick={() => onClose(item.id)}
                className="ml-2 rounded px-1.5 text-slate-400 opacity-0 hover:bg-slate-700 hover:text-white group-hover:opacity-100"
                aria-label={`Close ${item.name}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-3 py-2 text-xs text-slate-500">No terminals. Click + to add.</li>
        )}
      </ul>
    </div>
  );
}
