import type { Epic } from '../types';

/** 에픽 목록 한 줄(키 + 요약, 선택 가능). recent=true 면 "최근" 뱃지 표시. */
export function EpicRow({
  epic,
  recent,
  onClick,
}: {
  epic: Epic;
  recent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded px-2 py-1.5 text-left transition-colors hover:bg-claude-500/10"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-claude-300">{epic.key}</span>
        {recent && (
          <span className="rounded bg-claude-500/15 px-1 text-[9px] text-claude-300/90">최근</span>
        )}
      </div>
      <div className="truncate text-xs text-ink-100">{epic.summary}</div>
    </button>
  );
}
