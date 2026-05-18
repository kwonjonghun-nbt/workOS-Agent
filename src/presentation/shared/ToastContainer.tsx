import { useToastStore, type ToastKind } from './toast-store';

const KIND_STYLES: Record<ToastKind, string> = {
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  success: 'border-claude-500/40 bg-claude-500/10 text-claude-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const KIND_ICONS: Record<ToastKind, string> = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
};

export function ToastContainer() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-soft backdrop-blur-md ${KIND_STYLES[t.kind]}`}
          role="status"
        >
          <span className="mt-0.5 text-base leading-none">{KIND_ICONS[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <div className="break-words">{t.message}</div>
            {t.detail && (
              <div className="mt-1 break-words text-xs opacity-80">{t.detail}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="rounded px-1 text-current/70 hover:bg-white/10"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
