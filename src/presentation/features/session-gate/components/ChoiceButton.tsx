/** ChooseStep 의 큰 선택 버튼(제목 + 설명). */
export function ChoiceButton({
  title,
  detail,
  onClick,
  disabled,
  muted,
}: {
  title: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-4 py-3 text-left transition-colors disabled:opacity-40 ${
        muted
          ? 'border-ink-800 hover:border-ink-700 hover:bg-ink-850/60'
          : 'border-claude-500/30 bg-claude-500/5 hover:border-claude-400/60 hover:bg-claude-500/10'
      }`}
    >
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-0.5 text-xs text-ink-400">{detail}</div>
    </button>
  );
}
