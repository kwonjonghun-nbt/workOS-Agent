import { useState } from 'react';

type Props = {
  tileLabel: string;
  labels: string[];
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
};

/**
 * Asks the user to fill in `{{prompt[:label]}}` tokens before a macro runs.
 * The label is shown as the field name (empty label = "value"). The shape
 * passed back keys by label, matching what the service expects.
 */
export function PromptCollectorModal({ tileLabel, labels, onCancel, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(labels.map((l) => [l, ''])),
  );

  const handleSubmit = () => onSubmit(values);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onCancel}
    >
      <div
        className="flex w-[460px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-ink-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-100">
            "{tileLabel}" 실행 — 값 입력
          </h2>
          <p className="mt-1 text-[11px] text-ink-500">
            이 매크로는 실행 시 다음 값을 필요로 합니다.
          </p>
        </header>

        <div className="space-y-3 px-5 py-4">
          {labels.map((label) => (
            <label key={label} className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-500">
                {label || 'value'}
              </span>
              <input
                type="text"
                autoFocus={label === labels[0]}
                value={values[label] ?? ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [label]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
                }}
                className="w-full rounded border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-ink-100 outline-none focus:border-claude-500"
              />
            </label>
          ))}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-ink-800 px-5 py-3">
          <span className="mr-auto text-[10px] text-ink-600">⌘/Ctrl + Enter</span>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded bg-claude-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-claude-400"
          >
            실행
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Scans an array of action strings for `{{prompt[:label]}}` tokens and
 * returns the deduplicated label list (empty string for unlabeled prompt).
 */
export function collectPromptLabels(actions: import('../../../api/macro').MacroAction[]): string[] {
  const labels = new Set<string>();
  const re = /\{\{\s*prompt(?::([^}]*))?\s*\}\}/g;
  const visit = (s: string | undefined) => {
    if (!s) return;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      labels.add((m[1] ?? '').trim());
    }
  };
  for (const a of actions) {
    switch (a.kind) {
      case 'shell':
        visit(a.command);
        break;
      case 'http':
        visit(a.url);
        visit(a.body);
        if (a.headers) for (const v of Object.values(a.headers)) visit(v);
        break;
      case 'os.open':
        visit(a.target);
        break;
      case 'os.clipboard':
        visit(a.text);
        break;
      case 'ai':
        visit(a.prompt);
        break;
      case 'keystroke':
        visit(a.app);
        for (const s of a.steps) {
          if (s.type === 'text') visit(s.text);
          else if (s.type === 'keys') visit(s.keys);
        }
        break;
      case 'delay':
        break;
    }
  }
  return Array.from(labels);
}
