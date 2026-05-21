import { useState } from 'react';
import {
  useExtensionList,
  useSetExtensionEnabled,
} from '../../../business/extension/use-extensions';
import type { ExtensionListItem } from '../../../server-state/extension';
import { ExtensionSettingsForm } from './ExtensionSettingsForm';

/**
 * Catalog of first-party extensions. Each row has an enable toggle and, if the
 * extension declares settings, an inline expandable settings form.
 */
export function ExtensionsManager() {
  const extQuery = useExtensionList();
  const extensions = extQuery.data ?? [];

  if (extensions.length === 0) {
    return (
      <div className="p-4 text-xs text-ink-500">
        제공되는 확장이 없습니다.
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {extensions.map((ext) => (
        <CatalogRow key={ext.manifest.id} ext={ext} />
      ))}
    </ul>
  );
}

function CatalogRow({ ext }: { ext: ExtensionListItem }) {
  const setEnabled = useSetExtensionEnabled();
  const [expanded, setExpanded] = useState(false);
  const m = ext.manifest;
  const hasSettings =
    m.contributes.settings &&
    Object.keys(m.contributes.settings.schema ?? {}).length > 0;

  return (
    <li className="border-b border-ink-800/70 px-3 py-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink-100">{m.name}</span>
            <span className="rounded bg-ink-850 px-1 py-0.5 text-[10px] text-ink-400">
              v{m.version}
            </span>
            {ext.enabled ? (
              <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-300">
                활성
              </span>
            ) : (
              <span className="rounded bg-ink-800 px-1 py-0.5 text-[10px] text-ink-500">
                비활성
              </span>
            )}
          </div>
          {m.description && (
            <p className="mt-1 line-clamp-2 text-ink-400">{m.description}</p>
          )}
          {m.author && <div className="mt-1.5 text-[10px] text-ink-500">{m.author}</div>}
        </div>
        <Toggle
          checked={ext.enabled}
          onChange={(v) => void setEnabled(m.id, v)}
          ariaLabel={`${m.name} 활성화`}
        />
      </div>
      {hasSettings && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-ink-400 hover:text-ink-100"
          >
            {expanded ? '▾ 설정 닫기' : '▸ 설정'}
          </button>
          {expanded && (
            <div className="mt-2 rounded border border-ink-800 bg-ink-900/60 p-3">
              <ExtensionSettingsForm extensionId={m.id} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-claude-500' : 'bg-ink-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
