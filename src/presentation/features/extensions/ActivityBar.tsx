import { useExtensionList } from '../../../business/extension/use-extensions';
import { useExtensionStore, viewKey } from '../../../business/extension/extension-store';

// Always-present built-in entry that opens the extension manager.
const BUILTIN_KEY = 'workos-agent.extensions:manage';
// Sentinel for the Home button — closes any active extension view and
// returns the main slot to the workspace workflow.
const HOME_KEY = '__home__';

type ActivityItem = {
  key: string;
  icon: string;
  title: string;
  badge?: number;
};

export function ActivityBar() {
  const extQuery = useExtensionList();
  const extensions = extQuery.data ?? [];
  const activeKey = useExtensionStore((s) => s.activeViewKey);
  const setActiveView = useExtensionStore((s) => s.setActiveView);

  const items: ActivityItem[] = [
    {
      key: HOME_KEY,
      icon: '⌂',
      title: '홈 — 워크플로우 보기',
    },
    {
      key: BUILTIN_KEY,
      icon: '⌬',
      title: 'Extensions',
      badge: extensions.length || undefined,
    },
    ...extensions
      .filter((e) => e.enabled)
      .flatMap((e) =>
        e.manifest.contributes.views.map((v) => ({
          key: viewKey(e.manifest.id, v.id),
          icon: v.icon,
          title: `${e.manifest.name} · ${v.title}`,
        })),
      ),
  ];

  const onClick = (key: string) => {
    if (key === HOME_KEY) {
      setActiveView(null);
      return;
    }
    setActiveView(activeKey === key ? null : key);
  };

  return (
    <div className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-ink-800 bg-ink-950/70 py-2">
      {items.map((it) => {
        const active = it.key === HOME_KEY ? activeKey === null : it.key === activeKey;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onClick(it.key)}
            title={it.title}
            aria-label={it.title}
            className={`relative flex h-9 w-9 items-center justify-center rounded-md text-base transition-colors ${
              active
                ? 'bg-claude-500/15 text-claude-300'
                : 'text-ink-400 hover:bg-ink-850/60 hover:text-ink-100'
            }`}
          >
            {active && (
              <span className="absolute left-[-6px] top-1.5 h-6 w-[2px] rounded-full bg-claude-400" />
            )}
            <span className="leading-none">{it.icon}</span>
            {it.badge !== undefined && it.badge > 0 && (
              <span className="absolute -bottom-0.5 -right-0.5 min-w-[14px] rounded-full bg-claude-500 px-1 text-[9px] font-semibold leading-[14px] text-white">
                {it.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const EXTENSIONS_MANAGER_VIEW_KEY = BUILTIN_KEY;
