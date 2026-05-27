import { useEffect, useState } from 'react';
import {
  useImportWorkflowEdit,
  useRequestAiWorkflowEdit,
} from '../../../business/workOS/use-workOS';
import { useWorkOSStore } from '../../../business/workOS/workOS-store';
import { useWorkspaceStore } from '../../../business/workspace/workspace-store';
import { toast } from '../../shared/toast-store';

type Props = {
  workspaceId: string;
  workflowId: string;
  workflowName: string;
  onClose: () => void;
  onApplied?: (workflowId: string) => void;
};

/**
 * 자연어로 기존 워크플로를 수정한다.
 * 진행 중인 draft 는 `useWorkOSStore.aiWorkflowEditDraftByWorkflow[workflowId]` 에 보관되어
 * 모달을 닫아도 보존된다.
 */
export function AiWorkflowEditModal({
  workspaceId,
  workflowId,
  workflowName,
  onClose,
  onApplied,
}: Props) {
  const draft = useWorkOSStore((s) => s.aiWorkflowEditDraftByWorkflow[workflowId] ?? null);
  const setDraft = useWorkOSStore((s) => s.setAiWorkflowEditDraft);

  const [instruction, setInstruction] = useState(draft?.instruction ?? '');
  const phase: 'compose' | 'requested' = draft ? 'requested' : 'compose';

  const request = useRequestAiWorkflowEdit();
  const importEdit = useImportWorkflowEdit();

  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);
  const setTerminalPanelOpen = useWorkspaceStore((s) => s.setTerminalPanelOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    const text = instruction.trim();
    if (!text) {
      toast.warning('수정 지시를 입력해 주세요');
      return;
    }
    try {
      setTerminalPanelOpen(workspaceId, true);
      const res = await request.mutateAsync({
        workspaceId,
        workflowId,
        instruction: text,
      });
      setDraft(workflowId, {
        draftId: res.draftId,
        outputJsonPath: res.outputJsonPath,
        instruction: text,
        sessionId: res.sessionId,
        startedAt: Date.now(),
      });
      setActiveTerminal(workspaceId, res.sessionId);
      toast.info(
        '🛠 Claude 가 워크플로 수정안을 작성 중',
        '오른쪽 터미널에서 진행을 확인한 뒤 “변경 적용” 을 누르세요. 모달을 닫아도 진행 상태는 유지됩니다.',
      );
    } catch {
      /* mutation cache toasts */
    }
  };

  const handleApply = async () => {
    if (!draft) return;
    try {
      const { workflowId: appliedId } = await importEdit.mutateAsync({
        workspaceId,
        workflowId,
        draftId: draft.draftId,
      });
      setDraft(workflowId, null);
      toast.success('워크플로 수정 적용 완료', '변경된 Step 시퀀스로 갱신되었습니다.');
      onApplied?.(appliedId);
      onClose();
    } catch {
      /* */
    }
  };

  const handleCancelDraft = () => {
    if (!draft) return;
    if (
      !window.confirm(
        '진행 중인 AI 워크플로 수정을 취소하고 draft 추적을 삭제할까요? (이미 만들어진 .json 파일은 디스크에 남습니다)',
      )
    ) {
      return;
    }
    setDraft(workflowId, null);
    toast.info('진행 중인 AI 워크플로 수정 취소', '필요하면 다시 시작할 수 있습니다.');
    onClose();
  };

  const focusTerminal = () => {
    if (!draft) return;
    setTerminalPanelOpen(workspaceId, true);
    setActiveTerminal(workspaceId, draft.sessionId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-850 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              🛠 AI로 워크플로 수정 — <span className="text-claude-300">{workflowName}</span>
            </h2>
            <p className="text-xs text-ink-400">
              지시를 적으면 Claude CLI 가 현재 Step 시퀀스를 보고 수정안을 작성합니다.
              적용 시 기존 워크플로의 Step 시퀀스가 교체됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-ink-400 hover:bg-ink-850 hover:text-white"
            aria-label="닫기"
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ol className="mb-4 flex items-center gap-2 text-xs">
            <PhaseDot label="① 수정 지시" active={phase === 'compose'} done={phase !== 'compose'} />
            <span className="h-px flex-1 bg-ink-700" />
            <PhaseDot label="② Claude 작업 중" active={phase === 'requested'} done={false} />
            <span className="h-px flex-1 bg-ink-700" />
            <PhaseDot label="③ 변경 적용" active={false} done={false} />
          </ol>

          {phase === 'compose' && (
            <>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                어떻게 수정할까요?
              </label>
              <textarea
                autoFocus
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={[
                  '예시)',
                  '- 테스트 단계를 단위 테스트 / 통합 테스트 / E2E 테스트 3단계로 나눠줘.',
                  '- 코드 리뷰 단계 뒤에 보안 리뷰 단계를 추가해줘.',
                  '- "기능 조립" 스텝의 에이전트를 frontend-form-implementer 로 바꿔줘.',
                  '- 마지막 "커밋 & PR" 스텝은 제거.',
                ].join('\n')}
                className="w-full min-h-[220px] resize-y rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-claude-500"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit();
                }}
              />
              <p className="mt-2 text-[11px] text-ink-500">
                팁: 추가/삭제/순서 변경/이름 변경/에이전트 교체 등 자유롭게 지시할 수 있습니다.{' '}
                <span className="mx-1 rounded bg-ink-850 px-1 py-0.5 text-ink-300">⌘+Enter</span>
                로 즉시 요청.
              </p>
              <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-200">
                ⚠ 적용 시 이 워크플로의 Step 시퀀스가 통째로 교체됩니다. 기존 Step 자체는
                삭제되지 않지만 (다른 워크플로 참조 보호), 이 워크플로에서는 더 이상 사용되지
                않게 됩니다.
              </div>
            </>
          )}

          {phase === 'requested' && draft && (
            <div className="space-y-3">
              <div className="rounded border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-ink-200">
                <div className="mb-1 font-semibold text-sky-300">
                  Claude 가 수정안을 작성 중입니다.
                </div>
                <p className="text-xs text-ink-400">
                  Claude 가 확인을 요청하면 <strong>오른쪽 터미널에서 직접 응답</strong>해 주세요.
                  모달을 닫아도 진행은 끊기지 않으며, 워크플로 편집 헤더의 “이어서 진행” 배너로
                  언제든 돌아올 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={focusTerminal}
                  className="mt-3 rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-500/20"
                >
                  → 터미널에 포커스 (모달 닫기)
                </button>
              </div>
              <div className="rounded border border-ink-850 bg-ink-950 p-3 text-[11px] text-ink-500">
                <div className="mb-1 font-semibold text-ink-400">출력 파일</div>
                <code className="break-all">{draft.outputJsonPath}</code>
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-ink-400 hover:text-ink-200">
                  내가 보낸 수정 지시 보기
                </summary>
                <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-ink-950 p-2 text-[11px] text-ink-400 whitespace-pre-wrap">
                  {draft.instruction}
                </pre>
              </details>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-ink-850 bg-ink-900/60 px-5 py-3">
          <div className="text-[11px] text-ink-500">
            {phase === 'compose' && (
              <>
                결과 파일은 워크스페이스의{' '}
                <code className="text-ink-400">.claude/workOS/workflow-edits/</code> 에 저장됩니다.
              </>
            )}
            {phase === 'requested' && draft && (
              <>
                draftId: <code className="text-ink-400">{draft.draftId.slice(0, 10)}…</code>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {phase === 'requested' && (
              <button
                type="button"
                onClick={handleCancelDraft}
                className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
              >
                진행 취소
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-850"
              title={phase === 'requested' ? '모달만 닫음 — 진행 상태는 유지됩니다.' : '취소'}
            >
              {phase === 'requested' ? '나중에 적용' : '취소'}
            </button>

            {phase === 'compose' && (
              <button
                type="button"
                disabled={!instruction.trim() || request.isPending}
                onClick={() => void handleSubmit()}
                className="rounded bg-claude-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-400 disabled:opacity-40"
              >
                {request.isPending ? '요청 중…' : '🛠 Claude 에게 수정 요청'}
              </button>
            )}

            {phase === 'requested' && (
              <button
                type="button"
                disabled={importEdit.isPending}
                onClick={() => void handleApply()}
                className="rounded bg-claude-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-400 disabled:opacity-40"
              >
                {importEdit.isPending ? '적용 중…' : '📥 변경 적용'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function PhaseDot({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  const cls = done ? 'text-claude-300' : active ? 'text-sky-300' : 'text-ink-500';
  const dot = done ? '●' : active ? '◉' : '○';
  return (
    <span className={`flex items-center gap-1 whitespace-nowrap ${cls}`}>
      <span aria-hidden>{dot}</span>
      <span>{label}</span>
    </span>
  );
}

/** WorkflowEditor 헤더에 표시되는 "이어서 진행" 배너 */
export function AiWorkflowEditResumeBanner({
  workspaceId,
  workflowId,
  onResume,
}: {
  workspaceId: string;
  workflowId: string;
  onResume: () => void;
}) {
  const draft = useWorkOSStore((s) => s.aiWorkflowEditDraftByWorkflow[workflowId] ?? null);
  const setDraft = useWorkOSStore((s) => s.setAiWorkflowEditDraft);
  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);
  const setTerminalPanelOpen = useWorkspaceStore((s) => s.setTerminalPanelOpen);
  const importEdit = useImportWorkflowEdit();

  if (!draft) return null;

  const sinceMin = Math.max(1, Math.floor((Date.now() - draft.startedAt) / 60000));

  return (
    <div className="border-b border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs">
      <div className="mb-1 flex items-center gap-2 font-semibold text-sky-300">
        <span>🛠 진행 중인 AI 워크플로 수정</span>
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px]">
          {sinceMin}분 전 시작
        </span>
      </div>
      <p className="mb-2 text-ink-300">
        Claude 가 수정안을 작성하면 “적용” 을 누르세요. 터미널에서 확인이 필요하면 “터미널 보기” 로 이동.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={importEdit.isPending}
          onClick={async () => {
            try {
              await importEdit.mutateAsync({
                workspaceId,
                workflowId,
                draftId: draft.draftId,
              });
              setDraft(workflowId, null);
              toast.success('워크플로 수정 적용 완료', '변경된 Step 시퀀스로 갱신되었습니다.');
            } catch {
              /* toasted */
            }
          }}
          className="rounded bg-claude-500/90 px-2 py-1 text-[11px] font-medium text-white hover:bg-claude-400 disabled:opacity-40"
        >
          {importEdit.isPending ? '적용 중…' : '📥 적용'}
        </button>
        <button
          type="button"
          onClick={() => {
            setTerminalPanelOpen(workspaceId, true);
            setActiveTerminal(workspaceId, draft.sessionId);
          }}
          className="rounded border border-sky-500/40 px-2 py-1 text-[11px] text-sky-300 hover:bg-sky-500/20"
          title="이 draft 작업을 수행 중인 터미널 세션으로 이동"
        >
          → 터미널 보기
        </button>
        <button
          type="button"
          onClick={onResume}
          className="rounded border border-ink-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-ink-850"
        >
          모달 열기
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                '진행 중인 AI 워크플로 수정 추적을 삭제할까요? (생성 중인 .json 파일은 디스크에 남습니다)',
              )
            ) {
              setDraft(workflowId, null);
            }
          }}
          className="rounded px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
        >
          취소
        </button>
      </div>
      <div className="mt-1.5 truncate text-[10px] text-ink-500" title={draft.outputJsonPath}>
        out: {draft.outputJsonPath}
      </div>
    </div>
  );
}
