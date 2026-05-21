import {
  parseViewKey,
  useExtensionStore,
} from '../../../business/extension/extension-store';
import { useExtensionList } from '../../../business/extension/use-extensions';
import type { ExtensionViewBodyBlock } from '../../../server-state/extension';
import { ExtensionsManager } from './ExtensionsManager';
import { ExtensionSettingsForm } from './ExtensionSettingsForm';
import { ExtensionTerminal } from './ExtensionTerminal';
import { ExtensionTerminalPanel } from './ExtensionTerminalPanel';
import { EXTENSIONS_MANAGER_VIEW_KEY } from './ActivityBar';
import { resolveExtensionComponent } from './component-registry';

/**
 * Renders the currently selected extension view as a full main-area panel.
 * The host's WorkspaceShell decides whether to render this OR the workspace
 * pane(s) based on `activeViewKey` — they share the same content slot.
 */
export function ExtensionsSidebar() {
  const activeKey = useExtensionStore((s) => s.activeViewKey);
  const setActiveView = useExtensionStore((s) => s.setActiveView);
  const extQuery = useExtensionList();

  if (!activeKey) return null;

  if (activeKey === EXTENSIONS_MANAGER_VIEW_KEY) {
    return (
      <PanelFrame title="Extensions" onClose={() => setActiveView(null)}>
        <ExtensionsManager />
      </PanelFrame>
    );
  }

  const parsed = parseViewKey(activeKey);
  const ext = parsed
    ? extQuery.data?.find((e) => e.manifest.id === parsed.extensionId)
    : undefined;
  const view = ext && parsed
    ? ext.manifest.contributes.views.find((v) => v.id === parsed.viewId)
    : undefined;

  if (!ext || !view) {
    return (
      <PanelFrame title="Unavailable" onClose={() => setActiveView(null)}>
        <div className="p-4 text-xs text-ink-400">
          이 뷰를 제공하던 확장이 비활성화되었거나 제거되었습니다.
        </div>
      </PanelFrame>
    );
  }

  return (
    <ExtensionViewPanel
      extensionId={ext.manifest.id}
      extensionName={ext.manifest.name}
      viewTitle={view.title}
      body={view.body}
      onClose={() => setActiveView(null)}
    />
  );
}

function ExtensionViewPanel({
  extensionId,
  extensionName,
  viewTitle,
  body,
  onClose,
}: {
  extensionId: string;
  extensionName: string;
  viewTitle: string;
  body: ExtensionViewBodyBlock[];
  onClose: () => void;
}) {
  const terminalOpen = useExtensionStore(
    (s) => s.terminalOpenByExtension[extensionId] ?? false,
  );
  const toggleTerminal = useExtensionStore((s) => s.toggleTerminal);
  const setTerminalOpen = useExtensionStore((s) => s.setTerminalOpen);

  // 단일 'custom' / 'terminal' 블록만 가진 view 는 panel 내부를 가득 채우도록 한다.
  const isFullBleed =
    body.length === 1 && (body[0].type === 'custom' || body[0].type === 'terminal');

  const content =
    body.length === 0 ? (
      <div className="p-6 text-xs text-ink-500">
        이 뷰는 본문을 선언하지 않았습니다.
      </div>
    ) : isFullBleed ? (
      <div className="h-full min-h-0">
        <ViewBodyBlock block={body[0]} extensionId={extensionId} />
      </div>
    ) : (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        {body.map((block, idx) => (
          <ViewBodyBlock key={idx} block={block} extensionId={extensionId} />
        ))}
      </div>
    );

  return (
    <PanelFrame
      title={`${viewTitle} · ${extensionName}`}
      onClose={onClose}
      headerExtras={
        <button
          type="button"
          onClick={() => toggleTerminal(extensionId)}
          className={`mr-2 rounded px-2 py-1 text-[11px] font-medium transition-colors ${
            terminalOpen
              ? 'bg-claude-500/20 text-claude-200'
              : 'text-ink-400 hover:bg-ink-850/70 hover:text-ink-100'
          }`}
          title={terminalOpen ? 'AI 터미널 닫기' : 'AI 터미널 열기'}
          aria-pressed={terminalOpen}
        >
          ⌨ AI Terminal
        </button>
      }
    >
      {/*
        Stable layout: content's parent is ALWAYS the same div, so toggling the
        terminal does not unmount/remount the view body (which would reset any
        local section state — e.g. Jira workspace's selected nav tab).
        The terminal pane is a conditional sibling, not a parent.
      */}
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">{content}</div>
        {terminalOpen ? (
          <div className="h-[40%] min-h-[200px] shrink-0 border-t border-ink-800">
            <ExtensionTerminalPanel
              extensionId={extensionId}
              onClose={() => setTerminalOpen(extensionId, false)}
            />
          </div>
        ) : null}
      </div>
    </PanelFrame>
  );
}

function PanelFrame({
  title,
  onClose,
  headerExtras,
  children,
}: {
  title: string;
  onClose: () => void;
  headerExtras?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full w-full flex-col bg-ink-900">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900/95 px-4 text-xs font-semibold uppercase tracking-wider text-ink-300">
        <span className="truncate">{title}</span>
        <div className="flex items-center">
          {headerExtras}
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-ink-500 hover:bg-ink-850/70 hover:text-ink-100"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

function ViewBodyBlock({
  block,
  extensionId,
}: {
  block: ExtensionViewBodyBlock;
  extensionId: string;
}) {
  if (block.type === 'markdown') {
    return (
      <div className="whitespace-pre-wrap rounded border border-ink-800 bg-ink-900 p-4 text-sm leading-relaxed text-ink-200">
        {block.value}
      </div>
    );
  }
  if (block.type === 'settings') {
    return <ExtensionSettingsForm extensionId={extensionId} />;
  }
  if (block.type === 'custom') {
    const Comp = resolveExtensionComponent(block.component);
    if (!Comp) {
      return (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-[11px] text-rose-300">
          알 수 없는 커스텀 컴포넌트: {block.component}
        </div>
      );
    }
    return <Comp />;
  }
  if (block.type === 'terminal') {
    return <ExtensionTerminal extensionId={extensionId} title={block.title} />;
  }
  return null;
}
