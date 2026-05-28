import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { workspaceMutations } from '../../../server-state/workspace';
import type { TaskSource, Workspace } from '../../../api/workspace';

type Props = {
  workspace: Workspace;
};

/**
 * 워크스페이스 단위 설정(⚙) — 작업 소스 토글 + Jira 기본 이슈 타입.
 * 워크플로 단위 설정이 아니라 워크스페이스 전체에 단일로 적용된다.
 */
export function WorkspaceSettingsButton({ workspace }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const update = useMutation(workspaceMutations.updateSettings());

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const measure = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onTaskSourceChange = (taskSource: TaskSource) => {
    void update.mutateAsync({ id: workspace.id, patch: { taskSource } });
  };

  const taskSource = workspace.taskSource ?? 'local';

  return (
    <div ref={rootRef} className="app-no-drag relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-850/70 hover:text-ink-100"
        title="워크스페이스 설정"
        aria-label="Workspace settings"
        aria-expanded={open}
      >
        <span className="text-sm leading-none">⚙</span>
      </button>
      {open && panelPos && createPortal(
        <div
          ref={panelRef}
          style={{ top: panelPos.top, right: panelPos.right }}
          className="app-no-drag fixed z-[1000] w-72 rounded-lg border border-ink-700 bg-ink-900 p-3 shadow-2xl"
          role="dialog"
          aria-label="워크스페이스 설정"
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            {workspace.name}
          </div>
          <div className="mb-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
              Task 소스
            </div>
            <div className="flex items-center gap-3 text-xs">
              {(['local', 'jira'] as const).map((src) => (
                <label
                  key={src}
                  className="flex cursor-pointer items-center gap-1"
                >
                  <input
                    type="radio"
                    name={`workspace-taskSource-${workspace.id}`}
                    value={src}
                    checked={taskSource === src}
                    onChange={() => onTaskSourceChange(src)}
                    className="accent-claude-500"
                  />
                  <span className="text-ink-300">
                    {src === 'local' ? 'Local' : 'Jira'}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-ink-500">
              이 워크스페이스의 모든 워크플로가 이 설정을 따릅니다.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
