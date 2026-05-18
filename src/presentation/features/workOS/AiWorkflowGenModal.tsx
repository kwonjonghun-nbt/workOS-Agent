import { useEffect, useState } from 'react';
import {
  useImportWorkflowDraft,
  useRequestAiWorkflowGen,
} from '../../../business/workOS/use-workOS';
import { useWorkOSStore } from '../../../business/workOS/workOS-store';
import { useWorkspaceStore } from '../../../business/workspace/workspace-store';
import { toast } from '../../shared/toast-store';

type Props = {
  workspaceId: string;
  onClose: () => void;
  onCreated?: (workflowId: string) => void;
};

/**
 * 사용자가 요구사항을 적으면 Claude CLI 가 워크플로 드래프트를 생성하고,
 * "가져오기" 를 누르면 Steps + Workflow 가 만들어진다.
 *
 * 진행 중인 draft 는 `useWorkOSStore.aiWorkflowDraftByWorkspace[workspaceId]` 에 보관되어
 * 모달을 닫아도 보존된다. 닫으면 WorkflowsView 상단에 "이어서 진행" 배너가 뜬다.
 */
export function AiWorkflowGenModal({ workspaceId, onClose, onCreated }: Props) {
  const draft = useWorkOSStore((s) => s.aiWorkflowDraftByWorkspace[workspaceId] ?? null);
  const setDraft = useWorkOSStore((s) => s.setAiWorkflowDraft);

  const [requirement, setRequirement] = useState(draft?.requirement ?? '');
  // draft 가 있으면 ② phase 부터 시작 — 모달 재오픈 케이스.
  const phase: 'compose' | 'requested' = draft ? 'requested' : 'compose';

  const request = useRequestAiWorkflowGen();
  const importDraft = useImportWorkflowDraft();

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
    const text = requirement.trim();
    if (!text) {
      toast.warning('요구사항을 입력해 주세요');
      return;
    }
    try {
      setTerminalPanelOpen(workspaceId, true);
      const res = await request.mutateAsync({ workspaceId, requirement: text });
      setDraft(workspaceId, {
        draftId: res.draftId,
        outputJsonPath: res.outputJsonPath,
        requirement: text,
        sessionId: res.sessionId,
        startedAt: Date.now(),
      });
      setActiveTerminal(workspaceId, res.sessionId);
      toast.info(
        '🧠 Claude 가 워크플로를 설계 중',
        '오른쪽 터미널에서 진행을 확인한 뒤 “드래프트 가져오기” 를 누르세요. 모달을 닫아도 진행 상태는 유지됩니다.',
      );
    } catch {
      /* mutation cache toasts */
    }
  };

  const handleImport = async () => {
    if (!draft) return;
    try {
      const { workflowId } = await importDraft.mutateAsync({
        workspaceId,
        draftId: draft.draftId,
      });
      setDraft(workspaceId, null);
      toast.success('워크플로 생성 완료', '좌측 목록에 새 워크플로가 추가되었습니다.');
      onCreated?.(workflowId);
      onClose();
    } catch {
      /* */
    }
  };

  const handleCancelDraft = () => {
    if (!draft) return;
    if (
      !window.confirm(
        '진행 중인 AI 워크플로 생성을 취소하고 draft 추적을 삭제할까요? (이미 만들어진 .json 파일은 디스크에 남습니다)',
      )
    ) {
      return;
    }
    setDraft(workspaceId, null);
    toast.info('진행 중인 AI 워크플로 생성 취소', '필요하면 다시 시작할 수 있습니다.');
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
        className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">🧠 AI로 워크플로 만들기</h2>
            <p className="text-xs text-slate-400">
              요구사항을 적으면 Claude CLI 가 Step 시퀀스를 자동으로 설계합니다. 모달을 닫아도
              진행 상태는 유지됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="닫기"
            title="닫기 (Esc)"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <ol className="mb-4 flex items-center gap-2 text-xs">
            <PhaseDot label="① 요구사항 작성" active={phase === 'compose'} done={phase !== 'compose'} />
            <span className="h-px flex-1 bg-slate-700" />
            <PhaseDot label="② Claude 설계 중" active={phase === 'requested'} done={false} />
            <span className="h-px flex-1 bg-slate-700" />
            <PhaseDot label="③ 드래프트 가져오기" active={false} done={false} />
          </ol>

          {phase === 'compose' && (
            <>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                만들고 싶은 워크플로의 요구사항
              </label>
              <textarea
                autoFocus
                value={requirement}
                onChange={(e) => setRequirement(e.target.value)}
                placeholder={[
                  '예시)',
                  '- 백엔드 API 신규 개발용 워크플로를 만들고 싶다.',
                  '- 입력은 PRD 와 ERD 가 주어진다.',
                  '- DB 마이그레이션 → 도메인 모델 → 서비스 레이어 → 핸들러 → 통합 테스트 → API 문서 → PR 순서가 필요하다.',
                  '- 각 단계는 한 명의 전담 에이전트가 책임지고, 회사 컨벤션을 강제했으면 좋겠다.',
                ].join('\n')}
                className="w-full min-h-[260px] resize-y rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void handleSubmit();
                }}
              />
              <p className="mt-2 text-[11px] text-slate-500">
                팁: 분야 / 입력 자료 / 단계 수 / 산출물 / 강제하고 싶은 컨벤션 등을 적을수록 결과 품질이 올라갑니다.{' '}
                <span className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">⌘+Enter</span>
                로 즉시 요청.
              </p>
            </>
          )}

          {phase === 'requested' && draft && (
            <div className="space-y-3">
              <div className="rounded border border-sky-500/30 bg-sky-500/5 p-4 text-sm text-slate-200">
                <div className="mb-1 font-semibold text-sky-200">
                  Claude 가 워크플로를 설계 중입니다.
                </div>
                <p className="text-xs text-slate-400">
                  Claude 가 “파일을 읽어도 됩니까?” 처럼 확인을 요청하면, <strong>오른쪽 터미널에서 직접 응답</strong>해 주세요.
                  모달을 닫아도 진행은 끊기지 않으며, 워크플로 탭 상단의 “이어서 진행” 배너로 언제든
                  돌아올 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={focusTerminal}
                  className="mt-3 rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
                >
                  → 터미널에 포커스 (모달 닫기)
                </button>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-500">
                <div className="mb-1 font-semibold text-slate-400">출력 파일</div>
                <code className="break-all">{draft.outputJsonPath}</code>
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                  내가 보낸 요구사항 보기
                </summary>
                <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-slate-950 p-2 text-[11px] text-slate-400 whitespace-pre-wrap">
                  {draft.requirement}
                </pre>
              </details>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-900/60 px-5 py-3">
          <div className="text-[11px] text-slate-500">
            {phase === 'compose' && (
              <>모든 작업은 워크스페이스의 <code className="text-slate-400">.claude/workOS/</code> 안에 저장됩니다.</>
            )}
            {phase === 'requested' && draft && (
              <>
                draftId: <code className="text-slate-400">{draft.draftId.slice(0, 10)}…</code>
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
              className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              title={phase === 'requested' ? '모달만 닫음 — 진행 상태는 유지됩니다.' : '취소'}
            >
              {phase === 'requested' ? '나중에 가져오기' : '취소'}
            </button>

            {phase === 'compose' && (
              <button
                type="button"
                disabled={!requirement.trim() || request.isPending}
                onClick={() => void handleSubmit()}
                className="rounded bg-emerald-500/90 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
              >
                {request.isPending ? '요청 중…' : '🧠 Claude 에게 설계 요청'}
              </button>
            )}

            {phase === 'requested' && (
              <button
                type="button"
                disabled={importDraft.isPending}
                onClick={() => void handleImport()}
                className="rounded bg-emerald-500/90 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
              >
                {importDraft.isPending ? '불러오는 중…' : '📥 드래프트 가져오기'}
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
  const cls = done ? 'text-emerald-300' : active ? 'text-sky-300' : 'text-slate-500';
  const dot = done ? '●' : active ? '◉' : '○';
  return (
    <span className={`flex items-center gap-1 whitespace-nowrap ${cls}`}>
      <span aria-hidden>{dot}</span>
      <span>{label}</span>
    </span>
  );
}

/** WorkflowsView 좌측 패널 상단에 표시되는 "이어서 진행" 배너 */
export function AiWorkflowResumeBanner({
  workspaceId,
  onResume,
}: {
  workspaceId: string;
  onResume: () => void;
}) {
  const draft = useWorkOSStore((s) => s.aiWorkflowDraftByWorkspace[workspaceId] ?? null);
  const setDraft = useWorkOSStore((s) => s.setAiWorkflowDraft);
  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);
  const setTerminalPanelOpen = useWorkspaceStore((s) => s.setTerminalPanelOpen);
  const importDraft = useImportWorkflowDraft();

  if (!draft) return null;

  const sinceMin = Math.max(1, Math.floor((Date.now() - draft.startedAt) / 60000));

  return (
    <div className="border-b border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs">
      <div className="mb-1 flex items-center gap-2 font-semibold text-sky-200">
        <span>🧠 진행 중인 AI 워크플로 생성</span>
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px]">{sinceMin}분 전 시작</span>
      </div>
      <p className="mb-2 text-slate-300">
        Claude 가 결과를 작성하면 “가져오기” 를 누르세요. 터미널에서 확인이 필요하면
        “터미널 보기” 로 이동.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={importDraft.isPending}
          onClick={async () => {
            try {
              const { workflowId } = await importDraft.mutateAsync({
                workspaceId,
                draftId: draft.draftId,
              });
              setDraft(workspaceId, null);
              toast.success('워크플로 생성 완료', '좌측 목록에서 확인하세요.');
              void workflowId;
            } catch {
              /* toasted */
            }
          }}
          className="rounded bg-emerald-500/90 px-2 py-1 text-[11px] font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
        >
          {importDraft.isPending ? '불러오는 중…' : '📥 가져오기'}
        </button>
        <button
          type="button"
          onClick={() => {
            setTerminalPanelOpen(workspaceId, true);
            setActiveTerminal(workspaceId, draft.sessionId);
          }}
          className="rounded border border-sky-500/40 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-500/20"
          title="이 draft 작업을 수행 중인 터미널 세션으로 이동"
        >
          → 터미널 보기
        </button>
        <button
          type="button"
          onClick={onResume}
          className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
        >
          모달 열기
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                '진행 중인 AI 워크플로 생성 추적을 삭제할까요? (생성 중인 .json 파일은 디스크에 남습니다)',
              )
            ) {
              setDraft(workspaceId, null);
            }
          }}
          className="rounded px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10"
        >
          취소
        </button>
      </div>
      <div className="mt-1.5 truncate text-[10px] text-slate-500" title={draft.outputJsonPath}>
        out: {draft.outputJsonPath}
      </div>
    </div>
  );
}
