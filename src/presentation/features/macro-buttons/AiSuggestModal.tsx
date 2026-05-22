type Props = {
  prompt: string;
  onPromptChange: (next: string) => void;
  pending: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onMinimize: () => void;
  onSubmit: (prompt: string) => void;
};

/**
 * Natural-language prompt for the macro AI generator. Submitting kicks off a
 * claude CLI call in the extension's terminal panel; on success the parent
 * opens the TileEditor prefilled with the AI-suggested action sequence.
 */
export function AiSuggestModal({
  prompt,
  onPromptChange,
  pending,
  errorMessage,
  onCancel,
  onMinimize,
  onSubmit,
}: Props) {
  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || pending) return;
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onMinimize}
    >
      <div
        className="flex w-[520px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100">
            <span>🪄</span> AI 매크로 생성
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onMinimize}
              className="text-xs text-ink-500 hover:text-ink-200"
              title="잠시 닫기 (작업은 계속됩니다)"
            >
              —
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-ink-500 hover:text-ink-200"
              title="완전히 취소"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-xs text-ink-400">
            만들고 싶은 매크로를 자연어로 설명하세요. AI 가 shell / http / delay /
            os.open / clipboard 액션 시퀀스로 변환해 편집기에 채워줍니다.
          </p>

          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
            disabled={pending}
            rows={5}
            autoFocus
            placeholder={
              '예시:\n' +
              '- "현재 폴더에서 git status 실행하고 결과 보기"\n' +
              '- "https://example.com 열고 클립보드에 URL 복사"\n' +
              '- "5초 기다린 뒤 npm test 실행"'
            }
            className="w-full resize-none rounded border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-ink-100 outline-none focus:border-claude-500 disabled:opacity-60"
          />

          {pending && (
            <div className="flex items-center gap-2 rounded border border-claude-500/40 bg-claude-500/10 px-3 py-2 text-xs text-claude-200">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-claude-400" />
              AI 작업 중… 확장 터미널 패널에서 진행 상황을 볼 수 있습니다. (1~2분 소요)
            </div>
          )}

          {errorMessage && !pending && (
            <div className="rounded border border-rose-700/60 bg-rose-900/30 px-3 py-2 text-xs text-rose-300">
              {errorMessage}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-ink-800 px-5 py-3">
          <span className="mr-auto text-[10px] text-ink-600">⌘/Ctrl + Enter</span>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-800 disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending || !prompt.trim()}
            className="rounded bg-claude-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-claude-400 disabled:opacity-60"
          >
            {pending ? '생성 중…' : '🪄 생성'}
          </button>
        </footer>
      </div>
    </div>
  );
}
