import { useState } from 'react';
import type {
  MacroAction,
  MacroActionKind,
  MacroTile,
  MacroTileKind,
} from '../../../server-state/macro';
import { ActionRow, blankAction } from './ActionRow';

const PRESET_COLORS = [
  '#1f2937', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4',
];

type Props = {
  initial: MacroTile;
  exists: boolean;
  onCancel: () => void;
  onSave: (tile: MacroTile) => void;
  onDelete: () => void;
  saving?: boolean;
};

/**
 * Unified editor for both action tiles and group (folder) tiles. The kind
 * toggle at the top swaps the body between an action sequence editor and a
 * group descriptor. Switching kinds preserves common fields (label/icon/
 * color) so users can change their mind without retyping.
 */
export function ButtonEditor({ initial, exists, onCancel, onSave, onDelete, saving }: Props) {
  const [kind, setKind] = useState<MacroTileKind>(initial.kind);
  const [label, setLabel] = useState(initial.label);
  const [icon, setIcon] = useState(initial.icon ?? '');
  // Groups default to transparent (no fill) so they read as folders at a
  // glance; action tiles default to the first preset so they're visible.
  const [color, setColor] = useState<string | undefined>(
    initial.color ?? (initial.kind === 'action' ? PRESET_COLORS[0] : undefined),
  );
  const [actions, setActions] = useState<MacroAction[]>(
    initial.kind === 'action' ? initial.actions : [],
  );
  const [groupBoardId] = useState(
    initial.kind === 'group' ? initial.groupBoardId : makeId(),
  );

  const updateAction = (i: number, next: MacroAction) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? next : a)));
  const removeAction = (i: number) =>
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  const moveAction = (i: number, delta: -1 | 1) =>
    setActions((prev) => {
      const j = i + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const addAction = (k: MacroActionKind) =>
    setActions((prev) => [...prev, blankAction(k)]);

  const handleSave = () => {
    const trimmedLabel = label.trim() || (kind === 'group' ? '(그룹)' : '(이름 없음)');
    const base = {
      id: initial.id,
      slot: initial.slot,
      label: trimmedLabel,
      icon: icon.trim() || undefined,
      color: color || undefined,
    };
    if (kind === 'group') {
      onSave({ ...base, kind: 'group', groupBoardId });
    } else {
      onSave({ ...base, kind: 'action', actions });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[90vh] w-[640px] flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-950 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-100">
            {exists ? '타일 편집' : '새 타일'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-ink-500 hover:text-ink-200"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="mb-4 inline-flex rounded-md border border-ink-700 p-0.5 text-xs">
            <KindTab
              active={kind === 'action'}
              onClick={() => setKind('action')}
              disabled={exists && initial.kind === 'group'}
            >
              ⚡ 매크로
            </KindTab>
            <KindTab
              active={kind === 'group'}
              onClick={() => setKind('group')}
              disabled={exists && initial.kind === 'action'}
            >
              📁 그룹
            </KindTab>
          </div>

          <div className="grid grid-cols-[80px_1fr] gap-4">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-20 w-20 items-center justify-center rounded-lg text-ink-100 ${
                  color ? 'border border-ink-700' : 'border border-dashed border-ink-600 bg-ink-900/30'
                }`}
                style={color ? { background: color } : undefined}
              >
                {icon ? (
                  <span className="text-3xl leading-none">{icon}</span>
                ) : kind === 'group' ? (
                  <span className="text-3xl leading-none">📁</span>
                ) : (
                  <span className="text-center text-[11px] font-medium leading-tight px-1">
                    {label || '(이름)'}
                  </span>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-ink-600">
                preview
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <FieldInline label="라벨">
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className={inputClass}
                  />
                </FieldInline>
                <FieldInline label="아이콘 (이모지)">
                  <input
                    type="text"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder={kind === 'group' ? '예: 📁' : '예: 🚀'}
                    className={inputClass}
                  />
                </FieldInline>
              </div>
              <FieldInline label="색상">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setColor(undefined)}
                    className={`flex h-6 w-6 items-center justify-center rounded border-2 text-[10px] text-ink-500 ${
                      !color ? 'border-claude-400 bg-ink-900' : 'border-ink-700 bg-ink-900/40'
                    }`}
                    aria-label="색상 없음"
                    title="색상 없음 (투명)"
                  >
                    ✕
                  </button>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded border-2 ${
                        c === color ? 'border-claude-400' : 'border-ink-700'
                      }`}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                  <label
                    title="커스텀 색상 선택"
                    className={`relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded border-2 ${
                      isCustomColor(color) ? 'border-claude-400' : 'border-ink-700'
                    }`}
                    style={{
                      background: isCustomColor(color)
                        ? color
                        : 'conic-gradient(from 0deg, #ef4444, #f59e0b, #10b981, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)',
                    }}
                  >
                    <input
                      type="color"
                      value={color ?? '#3b82f6'}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label="커스텀 색상 선택"
                    />
                  </label>
                  {color && (
                    <span className="font-mono text-[10px] uppercase text-ink-500">
                      {color}
                    </span>
                  )}
                </div>
              </FieldInline>
            </div>
          </div>

          {kind === 'action' ? (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  액션 시퀀스 ({actions.length})
                </h3>
                <div className="flex gap-1">
                  {(['shell', 'http', 'delay', 'os.open', 'os.clipboard', 'keystroke', 'ai'] as MacroActionKind[]).map(
                    (k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => addAction(k)}
                        className="rounded border border-ink-700 bg-ink-900 px-2 py-1 text-[10px] text-ink-300 hover:bg-ink-800"
                      >
                        + {k}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {actions.length === 0 ? (
                <div className="rounded border border-dashed border-ink-700 p-6 text-center text-xs text-ink-500">
                  액션이 없습니다. 위에서 추가하세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {actions.map((a, i) => (
                    <ActionRow
                      key={i}
                      index={i}
                      action={a}
                      total={actions.length}
                      onChange={(next) => updateAction(i, next)}
                      onRemove={() => removeAction(i)}
                      onMove={(d) => moveAction(i, d)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded border border-dashed border-ink-700 bg-ink-900/40 p-4 text-xs text-ink-400">
              <p className="mb-1 font-medium text-ink-300">
                📁 그룹 타일 — 클릭하면 안쪽으로 들어갑니다.
              </p>
              <p>
                저장하면 빈 서브보드가 자동 생성됩니다. 그룹 안에 매크로를 추가하려면
                그룹을 클릭해 진입한 뒤 슬롯을 채우세요. 서브보드의 첫 슬롯은 자동
                "뒤로가기" 타일로 표시됩니다.
              </p>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-ink-800 px-5 py-3">
          <div>
            {exists && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded border border-rose-700/60 bg-rose-900/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-900/50"
              >
                삭제
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-800"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-claude-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-claude-400 disabled:opacity-60"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function KindTab({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? '기존 타일은 종류를 변경할 수 없습니다' : undefined}
      className={`rounded px-3 py-1 transition-colors ${
        active
          ? 'bg-claude-500/20 text-claude-200'
          : 'text-ink-400 hover:bg-ink-900 hover:text-ink-200'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function FieldInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function isCustomColor(color: string | undefined): boolean {
  if (!color) return false;
  return !PRESET_COLORS.some((c) => c.toLowerCase() === color.toLowerCase());
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const inputClass =
  'w-full rounded border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-100 outline-none focus:border-claude-500';
