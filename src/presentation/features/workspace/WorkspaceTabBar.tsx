import type { Workspace } from '../../../server-state/workspace';
import { useThemeStore } from '../../shared/theme-store';
import { WorkspaceSettingsButton } from './WorkspaceSettingsButton';

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
  const activeWorkspace = activeId ? byId.get(activeId) ?? null : null;

  return (
    <div className="app-drag flex h-11 shrink-0 items-center gap-1 border-b border-ink-800 bg-ink-900/95 pl-[88px] pr-2 backdrop-blur">
      <ul className="app-no-drag flex flex-1 items-center gap-1 overflow-x-auto py-1">
        {tabs.map((w) => {
          const active = w.id === activeId;
          return (
            <li
              key={w.id}
              className={`group flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? 'border-claude-500/40 bg-claude-500/10 text-claude-300'
                  : 'border-transparent text-ink-400 hover:bg-ink-850/60 hover:text-white'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  active ? 'bg-claude-400' : 'bg-ink-600 group-hover:bg-ink-400'
                }`}
              />
              <button
                type="button"
                onClick={() => onSelect(w.id)}
                className="max-w-[180px] truncate text-left"
                title={w.rootPath}
              >
                {w.name}
              </button>
              <button
                type="button"
                onClick={() => onCloseTab(w.id)}
                className="-mr-1 ml-0.5 rounded-full px-1 text-ink-500 opacity-0 transition-opacity hover:bg-ink-700/60 hover:text-white group-hover:opacity-100"
                aria-label={`Close workspace tab ${w.name}`}
              >
                ✕
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onAdd}
            className="ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-ink-400 transition-colors hover:bg-ink-850/70 hover:text-claude-300"
            aria-label="Open folder as workspace"
            title="폴더 열기"
          >
            <span className="text-sm leading-none">＋</span>
            <span>새 워크스페이스</span>
          </button>
        </li>
      </ul>
      {activeWorkspace && <WorkspaceSettingsButton workspace={activeWorkspace} />}
      <ThemeToggleButton />
    </div>
  );
}

function ThemeToggleButton() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = mode === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className="app-no-drag ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-850/70 hover:text-ink-100"
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-label="Toggle color theme"
    >
      <span className="text-sm leading-none">{isDark ? '☾' : '☀'}</span>
    </button>
  );
}
