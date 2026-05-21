import {
  parseViewKey,
  useExtensionStore,
} from '../../../business/extension/extension-store';
import { useExtensionList } from '../../../business/extension/use-extensions';
import type { ExtensionViewBodyBlock } from '../../../server-state/extension';
import { ExtensionsManager } from './ExtensionsManager';
import { ExtensionSettingsForm } from './ExtensionSettingsForm';
import { EXTENSIONS_MANAGER_VIEW_KEY } from './ActivityBar';
import { resolveExtensionComponent } from './component-registry';

/**
 * Renders the currently selected extension view as a full main-area panel.
 * The host's WorkspaceShell decides whether to render this OR the workspace
 * pane(s) based on `activeViewKey` — they share the same content slot.
 *
 * Returns null when no view is active so the caller can fall through to the
 * workspace content.
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
    <PanelFrame
      title={`${view.title} · ${ext.manifest.name}`}
      onClose={() => setActiveView(null)}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
        {view.body.length === 0 ? (
          <div className="text-xs text-ink-500">이 뷰는 본문을 선언하지 않았습니다.</div>
        ) : (
          view.body.map((block, idx) => (
            <ViewBodyBlock
              key={idx}
              block={block}
              extensionId={ext.manifest.id}
            />
          ))
        )}
      </div>
    </PanelFrame>
  );
}

function PanelFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full w-full flex-col bg-ink-900">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-ink-800 bg-ink-900/95 px-4 text-xs font-semibold uppercase tracking-wider text-ink-300">
        <span className="truncate">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-ink-500 hover:bg-ink-850/70 hover:text-ink-100"
          aria-label="Close panel"
        >
          ✕
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
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
  return null;
}
