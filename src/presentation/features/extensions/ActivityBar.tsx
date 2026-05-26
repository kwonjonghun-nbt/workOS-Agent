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
            <ActivityIcon icon={it.icon} active={active} />
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

function ActivityIcon({ icon, active }: { icon: string; active: boolean }) {
  if (icon === 'mark:github') return <GitHubMark active={active} />;
  if (icon === 'mark:jira') return <JiraMark active={active} />;
  if (icon === 'mark:slack') return <SlackMark active={active} />;
  return <span className="leading-none">{icon}</span>;
}

function GitHubMark({ active }: { active: boolean }) {
  // GitHub's "Octocat" logo (simple-icons / GitHub brand mark).
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-5 w-5 ${active ? 'fill-claude-300' : 'fill-current'}`}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.08 3.29 9.39 7.86 10.92.57.11.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.2.7-3.87-1.54-3.87-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.18 1.18a11 11 0 0 1 2.9-.39c.98 0 1.96.13 2.9.39 2.21-1.49 3.18-1.18 3.18-1.18.63 1.6.23 2.78.11 3.07.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.26 5.69.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.79.55C20.21 21.4 23.5 17.1 23.5 12.02 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function JiraMark({ active }: { active: boolean }) {
  // Atlassian Jira Software mark (three nested chevrons), simple-icons path.
  const fill = active ? '#7CC4FF' : '#2684FF';
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill={fill}>
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.001-1.005zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z" />
    </svg>
  );
}

function SlackMark({ active }: { active: boolean }) {
  // Slack 4-color hash mark (simple-icons path). Each rounded quadrant gets
  // its own brand color; on the active state we slightly brighten the palette.
  const colors = active
    ? { a: '#4FD1C5', b: '#F6E27A', c: '#FF9AB8', d: '#7AB8FF' }
    : { a: '#36C5F0', b: '#ECB22E', c: '#E01E5A', d: '#2EB67D' };
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5">
      <path
        fill={colors.c}
        d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"
      />
      <path
        fill={colors.a}
        d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"
      />
      <path
        fill={colors.d}
        d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"
      />
      <path
        fill={colors.b}
        d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
      />
    </svg>
  );
}

export const EXTENSIONS_MANAGER_VIEW_KEY = BUILTIN_KEY;
