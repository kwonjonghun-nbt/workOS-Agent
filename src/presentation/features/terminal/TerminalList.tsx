import { useEffect, useRef, useState } from 'react';

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
  onRename: (id: string, name: string) => void;
};

export function TerminalList({ items, activeId, onSelect, onAdd, onClose, onRename }: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full flex-col bg-ink-900">
      <div className="border-b border-ink-800 p-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-full border border-ink-800 bg-ink-850/60 px-3 py-1.5 text-xs font-medium text-claude-300 transition-colors hover:border-claude-500/40 hover:bg-claude-500/10"
          aria-label="Add terminal"
        >
          <span className="text-base leading-none">+</span>
          <span>새 터미널</span>
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {items.map((item) => (
          <TerminalRow
            key={item.id}
            item={item}
            active={item.id === activeId}
            menuOpen={menuOpenId === item.id}
            renaming={renamingId === item.id}
            onSelect={() => onSelect(item.id)}
            onClose={() => onClose(item.id)}
            onToggleMenu={() => setMenuOpenId((cur) => (cur === item.id ? null : item.id))}
            onCloseMenu={() => setMenuOpenId(null)}
            onStartRename={() => {
              setRenamingId(item.id);
              setMenuOpenId(null);
            }}
            onCancelRename={() => setRenamingId(null)}
            onCommitRename={(name) => {
              onRename(item.id, name);
              setRenamingId(null);
            }}
          />
        ))}
        {items.length === 0 && (
          <li className="px-3 py-2 text-xs text-ink-500">No terminals. Click + to add.</li>
        )}
      </ul>
    </div>
  );
}

type RowProps = {
  item: TerminalListItem;
  active: boolean;
  menuOpen: boolean;
  renaming: boolean;
  onSelect: () => void;
  onClose: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onCommitRename: (name: string) => void;
};

function TerminalRow({
  item,
  active,
  menuOpen,
  renaming,
  onSelect,
  onClose,
  onToggleMenu,
  onCloseMenu,
  onStartRename,
  onCancelRename,
  onCommitRename,
}: RowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocPointer = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) onCloseMenu();
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [menuOpen, onCloseMenu]);

  return (
    <li>
      <div
        ref={rowRef}
        className={`group relative flex items-center justify-between px-3 py-1.5 text-sm ${
          active ? 'bg-ink-850 text-white' : 'text-ink-300 hover:bg-ink-850/60'
        }`}
      >
        {renaming ? (
          <RenameInput
            initial={item.name}
            onCommit={onCommitRename}
            onCancel={onCancelRename}
          />
        ) : (
          <button type="button" onClick={onSelect} className="flex-1 truncate text-left">
            {item.name}
          </button>
        )}

        {!renaming && (
          <div className="ml-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={onToggleMenu}
              className="rounded px-1.5 text-ink-400 hover:bg-ink-700 hover:text-white"
              aria-label={`More options for ${item.name}`}
            >
              ⋯
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-1.5 text-ink-400 hover:bg-ink-700 hover:text-white"
              aria-label={`Close ${item.name}`}
            >
              ✕
            </button>
          </div>
        )}

        {menuOpen && (
          <div className="absolute right-2 top-full z-10 mt-1 w-32 rounded-md border border-ink-700 bg-ink-850 py-1 shadow-lg">
            <button
              type="button"
              onClick={onStartRename}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink-200 hover:bg-ink-700"
            >
              이름 변경
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value);
        else if (e.key === 'Escape') onCancel();
      }}
      className="flex-1 rounded border border-ink-600 bg-ink-900 px-1.5 py-0.5 text-sm text-white outline-none focus:border-claude-500"
    />
  );
}
