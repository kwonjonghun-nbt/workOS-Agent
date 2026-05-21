import { useState } from 'react';
import { LabelNotesTab } from './labels/LabelNotesTab';
import { LabelRenameTab } from './labels/LabelRenameTab';
import { LabelSuggestTab } from './labels/LabelSuggestTab';

type Tab = 'notes' | 'rename' | 'suggest';

const TABS: { key: Tab; label: string }[] = [
  { key: 'notes', label: '라벨 관리' },
  { key: 'rename', label: '라벨 변경' },
  { key: 'suggest', label: '라벨 추천' },
];

export function JiraLabels() {
  const [tab, setTab] = useState<Tab>('notes');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 self-start rounded border border-ink-800 bg-ink-900/60 p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded px-2.5 py-1 text-xs ${
              tab === t.key
                ? 'bg-ink-800 text-ink-100'
                : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'notes' ? (
        <LabelNotesTab />
      ) : tab === 'rename' ? (
        <LabelRenameTab />
      ) : (
        <LabelSuggestTab />
      )}
    </div>
  );
}
