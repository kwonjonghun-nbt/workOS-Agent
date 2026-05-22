import { useAiRuntimeStore } from '../../../business/macro-buttons/ai-runtime-store';
import { useExtensionStore, viewKey } from '../../../business/extension/extension-store';

const MACRO_VIEW_KEY = viewKey('workos.macro-buttons', 'workspace');

/**
 * Floating chip that shows the AI macro-generation status from anywhere in
 * the app. Mounted at the app root so navigating between extensions does not
 * unmount it. Clicking the chip switches back to the Macro Buttons panel and
 * either restores the modal or opens the editor with the ready draft.
 */
export function MacroAiBackgroundChip() {
  const status = useAiRuntimeStore((s) => s.status);
  const modalOpen = useAiRuntimeStore((s) => s.modalOpen);
  const restore = useAiRuntimeStore((s) => s.restore);
  const cancel = useAiRuntimeStore((s) => s.cancel);
  const setActiveView = useExtensionStore((s) => s.setActiveView);

  // Only surface a chip when there's actual work to show and the full modal
  // isn't already on screen.
  if (modalOpen) return null;
  if (status === 'idle') return null;

  const onClick = () => {
    setActiveView(MACRO_VIEW_KEY);
    restore();
  };

  const config = {
    pending: {
      bg: 'bg-claude-500/15 border-claude-500/40 text-claude-200',
      dot: 'bg-claude-400 animate-pulse',
      label: '🪄 AI 생성 중…',
    },
    ready: {
      bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
      dot: 'bg-emerald-400',
      label: '✓ 결과 준비됨 — 검토',
    },
    error: {
      bg: 'bg-rose-500/15 border-rose-500/40 text-rose-200',
      dot: 'bg-rose-400',
      label: '⚠ 오류 — 다시 열기',
    },
  }[status as 'pending' | 'ready' | 'error'];

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 flex justify-end">
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-lg ${config.bg}`}
      >
        <span className={`inline-block h-2 w-2 rounded-full ${config.dot}`} />
        <button type="button" onClick={onClick} className="font-medium">
          {config.label}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="rounded text-[10px] uppercase tracking-wider opacity-70 hover:opacity-100"
          title="취소"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
