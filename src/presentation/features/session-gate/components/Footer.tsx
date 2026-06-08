import type { ReactNode } from 'react';

/** 스텝 하단 바 — 항상 "← 뒤로"를 두고, 우측에 스텝별 액션(children)을 둔다. */
export function Footer({
  onBack,
  submitting,
  children,
}: {
  onBack: () => void;
  submitting: boolean;
  children?: ReactNode;
}) {
  return (
    <footer className="flex items-center justify-end gap-2 border-t border-ink-850 bg-ink-900/60 px-5 py-3">
      <button
        type="button"
        onClick={onBack}
        disabled={submitting}
        className="mr-auto rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-850 disabled:opacity-40"
      >
        ← 뒤로
      </button>
      {children}
    </footer>
  );
}
