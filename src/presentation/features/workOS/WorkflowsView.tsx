import { useEffect, useMemo, useState } from 'react';
import { AiWorkflowGenModal, AiWorkflowResumeBanner } from './AiWorkflowGenModal';
import {
  useCatalog,
  useCreateStep,
  useCreateWorkflow,
  useDeleteStep,
  useDeleteWorkflow,
  useSeedPreset,
  useSteps,
  useUpdateStep,
  useUpdateWorkflow,
  useWorkflows,
} from '../../../business/workOS/use-workOS';
import { toast } from '../../shared/toast-store';
import type { Step, Workflow } from '../../../server-state/workOS';
import { useWorkOSStore } from '../../../business/workOS/workOS-store';
import { Split } from '../../shared/Split';

type Props = { workspaceId: string };

export function WorkflowsView({ workspaceId }: Props) {
  const selected = useWorkOSStore((s) => s.selectedWorkflowByWorkspace[workspaceId] ?? null);
  const select = useWorkOSStore((s) => s.selectWorkflow);

  return (
    <Split direction="horizontal" initialFirstSize={32} minFirstSize={18} maxFirstSize={50}>
      <WorkflowList
        workspaceId={workspaceId}
        selectedId={selected}
        onSelect={(id) => select(workspaceId, id)}
      />
      <div className="flex h-full min-h-0 flex-col">
        {selected ? (
          <WorkflowEditor workspaceId={workspaceId} workflowId={selected} />
        ) : (
          <StepLibrary workspaceId={workspaceId} />
        )}
      </div>
    </Split>
  );
}

function WorkflowList({
  workspaceId,
  selectedId,
  onSelect,
}: {
  workspaceId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { data: workflows = [] } = useWorkflows(workspaceId);
  const create = useCreateWorkflow();
  const del = useDeleteWorkflow();
  const [name, setName] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);

  const handleCreate = async () => {
    const n = name.trim();
    if (!n) return;
    const wf = await create.mutateAsync({ workspaceId, name: n });
    setName('');
    onSelect(wf.id);
  };

  return (
    <div className="flex h-full flex-col border-r border-ink-850 bg-ink-900/40">
      <AiWorkflowResumeBanner workspaceId={workspaceId} onResume={() => setAiModalOpen(true)} />
      <div className="border-b border-ink-850 p-2">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
          워크플로
        </div>
        <button
          type="button"
          onClick={() => setAiModalOpen(true)}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20"
          title="요구사항을 적으면 Claude 가 Step 시퀀스를 자동 설계합니다."
        >
          🧠 AI 로 워크플로 만들기
        </button>
        <div className="flex gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
            placeholder="빈 워크플로 이름"
            className="flex-1 rounded border border-ink-700 bg-ink-950 px-2 py-1 text-sm outline-none focus:border-claude-500"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="rounded border border-transparent bg-claude-500/90 px-2.5 py-1 text-sm font-medium text-white hover:bg-claude-400"
            title="빈 워크플로를 추가하고 직접 Step 을 끼웁니다."
          >
            추가
          </button>
        </div>
      </div>
      {aiModalOpen && (
        <AiWorkflowGenModal
          workspaceId={workspaceId}
          onClose={() => setAiModalOpen(false)}
          onCreated={(id) => onSelect(id)}
        />
      )}
      <ul className="flex-1 overflow-y-auto">
        <li>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`block w-full px-3 py-2 text-left text-xs uppercase tracking-wide ${
              selectedId === null
                ? 'bg-ink-850 text-claude-300'
                : 'text-ink-500 hover:bg-ink-850/60 hover:text-ink-300'
            }`}
          >
            ⚙ Step 라이브러리
          </button>
        </li>
        {workflows.map((w) => (
          <li key={w.id}>
            <div
              className={`group flex items-center justify-between px-3 py-2 text-sm ${
                selectedId === w.id
                  ? 'bg-ink-850 text-white'
                  : 'text-ink-300 hover:bg-ink-850/60'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(w.id)}
                className="flex-1 truncate text-left"
                title={w.description}
              >
                {w.name}
                <span className="ml-2 text-xs text-ink-500">{w.stepIds.length} steps</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`'${w.name}' 워크플로를 삭제할까요?`)) {
                    void del.mutateAsync({ workspaceId, id: w.id }).then(() => {
                      if (selectedId === w.id) onSelect(null);
                    });
                  }
                }}
                className="opacity-0 group-hover:opacity-100 ml-1 rounded px-1 text-ink-400 hover:bg-ink-700 hover:text-white"
                aria-label={`Delete ${w.name}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {workflows.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-ink-500">
            아직 워크플로가 없습니다.
            <PresetCta workspaceId={workspaceId} />
          </li>
        )}
      </ul>
    </div>
  );
}

function PresetCta({ workspaceId }: { workspaceId: string }) {
  const seed = useSeedPreset();
  return (
    <button
      type="button"
      disabled={seed.isPending}
      onClick={async () => {
        try {
          await seed.mutateAsync({ workspaceId });
          toast.success('샘플 워크플로 생성 완료', '12개 Step + 1 워크플로가 추가되었습니다.');
        } catch {
          /* */
        }
      }}
      className="mt-3 block w-full rounded border border-claude-500/40 bg-claude-500/10 px-2 py-1.5 text-claude-300 hover:bg-claude-500/20 disabled:opacity-50"
    >
      {seed.isPending ? '생성 중…' : '✨ 샘플 워크플로 한 번에 만들기'}
    </button>
  );
}

function WorkflowEditor({ workspaceId, workflowId }: { workspaceId: string; workflowId: string }) {
  const { data: workflows = [] } = useWorkflows(workspaceId);
  const { data: steps = [] } = useSteps(workspaceId);
  const update = useUpdateWorkflow();

  const wf = workflows.find((w) => w.id === workflowId);
  if (!wf) return <div className="p-4 text-sm text-ink-500">워크플로를 찾을 수 없습니다.</div>;

  const byId = new Map(steps.map((s) => [s.id, s]));
  const orderedSteps = wf.stepIds.map((id) => byId.get(id)).filter((s): s is Step => Boolean(s));
  const remaining = steps.filter((s) => !wf.stepIds.includes(s.id));

  const move = (idx: number, dir: -1 | 1) => {
    const next = wf.stepIds.slice();
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    void update.mutateAsync({ workspaceId, id: wf.id, patch: { stepIds: next } });
  };
  const remove = (idx: number) => {
    const next = wf.stepIds.filter((_, i) => i !== idx);
    void update.mutateAsync({ workspaceId, id: wf.id, patch: { stepIds: next } });
  };
  const append = (stepId: string) => {
    void update.mutateAsync({
      workspaceId,
      id: wf.id,
      patch: { stepIds: [...wf.stepIds, stepId] },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ink-850 p-3">
        <input
          value={wf.name}
          onChange={(e) =>
            void update.mutateAsync({
              workspaceId,
              id: wf.id,
              patch: { name: e.target.value },
            })
          }
          className="w-full bg-transparent text-lg font-semibold outline-none"
        />
        <textarea
          value={wf.description}
          onChange={(e) =>
            void update.mutateAsync({
              workspaceId,
              id: wf.id,
              patch: { description: e.target.value },
            })
          }
          placeholder="이 워크플로의 목적을 짧게 적어주세요."
          className="mt-2 w-full resize-none rounded border border-ink-850 bg-ink-950 px-2 py-1 text-sm text-ink-300 outline-none focus:border-claude-500"
          rows={2}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <section className="flex min-h-0 flex-col border-r border-ink-850">
          <div className="border-b border-ink-850 bg-ink-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Step 순서 ({orderedSteps.length})
          </div>
          <ul className="flex-1 overflow-y-auto">
            {orderedSteps.map((step, idx) => (
              <li
                key={step.id}
                className="group flex items-center gap-2 border-b border-ink-850/50 px-3 py-2"
              >
                <span className="w-6 text-xs text-ink-500">{idx + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white">{step.name}</div>
                  <div className="truncate text-xs text-ink-500">
                    {step.agentNames.join(', ')}
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-50 group-hover:opacity-100">
                  <IconBtn label="위로" onClick={() => move(idx, -1)}>
                    ↑
                  </IconBtn>
                  <IconBtn label="아래로" onClick={() => move(idx, 1)}>
                    ↓
                  </IconBtn>
                  <IconBtn label="제거" onClick={() => remove(idx)}>
                    ✕
                  </IconBtn>
                </div>
              </li>
            ))}
            {orderedSteps.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-ink-500">
                오른쪽 라이브러리에서 Step을 추가하세요.
              </li>
            )}
          </ul>
        </section>
        <section className="flex min-h-0 flex-col">
          <div className="border-b border-ink-850 bg-ink-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Step 라이브러리 — 클릭해서 추가
          </div>
          <ul className="flex-1 overflow-y-auto">
            {remaining.map((step) => (
              <li
                key={step.id}
                className="border-b border-ink-850/50 px-3 py-2 hover:bg-ink-850/40"
              >
                <button
                  type="button"
                  onClick={() => append(step.id)}
                  className="w-full text-left"
                >
                  <div className="text-sm text-white">+ {step.name}</div>
                  <div className="truncate text-xs text-ink-500">
                    {step.agentNames.join(', ')}
                  </div>
                </button>
              </li>
            ))}
            {remaining.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-ink-500">
                추가 가능한 Step이 없습니다. ‘Step 라이브러리’ 메뉴에서 만들어 주세요.
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded px-1.5 text-ink-400 hover:bg-ink-700 hover:text-white"
    >
      {children}
    </button>
  );
}

function StepLibrary({ workspaceId }: { workspaceId: string }) {
  const { data: steps = [] } = useSteps(workspaceId);
  const { data: catalog } = useCatalog(workspaceId);
  const create = useCreateStep();
  const update = useUpdateStep();
  const del = useDeleteStep();

  const [draft, setDraft] = useState({ name: '', description: '', agent: '' });
  const [detailStepId, setDetailStepId] = useState<string | null>(null);
  const agentChoices = useMemo(() => catalog?.agents ?? [], [catalog]);
  const detailStep = useMemo(
    () => (detailStepId ? steps.find((s) => s.id === detailStepId) ?? null : null),
    [detailStepId, steps],
  );

  const onCreate = async () => {
    const n = draft.name.trim();
    const a = draft.agent.trim() || agentChoices[0]?.name;
    if (!n || !a) return;
    await create.mutateAsync({
      workspaceId,
      name: n,
      description: draft.description,
      agentNames: [a],
    });
    setDraft({ name: '', description: '', agent: '' });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ink-850 p-3">
        <div className="mb-2 text-sm font-semibold text-ink-200">Step 라이브러리</div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Step 이름 (예: API 레이어 개발)"
            className="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-sm outline-none focus:border-claude-500"
          />
          <select
            value={draft.agent}
            onChange={(e) => setDraft((d) => ({ ...d, agent: e.target.value }))}
            className="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-sm outline-none focus:border-claude-500"
          >
            <option value="">
              {agentChoices.length === 0
                ? '에이전트 없음 — 직접 입력하세요'
                : '에이전트 선택…'}
            </option>
            {agentChoices.map((a) => (
              <option key={a.name} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void onCreate()}
            className="rounded border border-transparent bg-claude-500/90 px-3 py-1 text-sm font-medium text-white hover:bg-claude-400 disabled:opacity-40"
            disabled={!draft.name.trim() || (!draft.agent && agentChoices.length === 0)}
          >
            Step 추가
          </button>
        </div>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="이 Step의 책임 / 분해 프롬프트에 주입될 설명"
          className="mt-2 w-full resize-none rounded border border-ink-700 bg-ink-950 px-2 py-1 text-sm outline-none focus:border-claude-500"
          rows={2}
        />
        {agentChoices.length === 0 && (
          <p className="mt-1 text-xs text-amber-300">
            ⚠ <code>.claude/agents/</code> 에서 에이전트를 찾지 못했습니다. 좌측 셀렉트가 비어 있다면
            직접 텍스트 박스로 입력해야 합니다.
          </p>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center gap-2 border-b border-ink-850/50 px-3 py-2">
            <button
              type="button"
              onClick={() => setDetailStepId(step.id)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="truncate text-sm font-medium text-white">{step.name}</div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
                <span className="rounded bg-ink-850 px-1.5 py-0.5">
                  {step.agentNames[0] ?? '에이전트 없음'}
                </span>
                {step.description && (
                  <span className="truncate text-ink-600">{step.description}</span>
                )}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDetailStepId(step.id)}
              className="rounded px-2 py-0.5 text-[11px] text-ink-300 hover:bg-ink-850"
            >
              상세
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`'${step.name}' Step을 삭제할까요?`)) {
                  void del.mutateAsync({ workspaceId, id: step.id });
                }
              }}
              className="rounded px-1.5 text-ink-400 hover:bg-ink-700 hover:text-white"
            >
              ✕
            </button>
          </li>
        ))}
        {steps.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-ink-500">
            아직 Step이 없습니다. 위에서 첫 Step을 만들어 보세요.
          </li>
        )}
      </ul>
      {detailStep && (
        <StepDetailModal
          workspaceId={workspaceId}
          step={detailStep}
          agentChoices={agentChoices}
          onClose={() => setDetailStepId(null)}
        />
      )}
    </div>
  );
}

function StepDetailModal({
  workspaceId,
  step,
  agentChoices,
  onClose,
}: {
  workspaceId: string;
  step: Step;
  agentChoices: { name: string }[];
  onClose: () => void;
}) {
  const update = useUpdateStep();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-850 px-5 py-3">
          <input
            autoFocus
            value={step.name}
            onChange={(e) =>
              void update.mutateAsync({
                workspaceId,
                id: step.id,
                patch: { name: e.target.value },
              })
            }
            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="ml-3 rounded px-2 py-0.5 text-ink-400 hover:bg-ink-850 hover:text-white"
            aria-label="닫기"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              설명 / 책임
            </label>
            <textarea
              value={step.description}
              onChange={(e) =>
                void update.mutateAsync({
                  workspaceId,
                  id: step.id,
                  patch: { description: e.target.value },
                })
              }
              placeholder="이 Step의 책임 / 분해 프롬프트에 주입될 설명"
              rows={10}
              className="w-full resize-y rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200 outline-none focus:border-claude-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              Agent
            </label>
            <select
              value={step.agentNames[0] ?? ''}
              onChange={(e) =>
                void update.mutateAsync({
                  workspaceId,
                  id: step.id,
                  patch: { agentNames: [e.target.value] },
                })
              }
              className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-claude-500"
            >
              {agentChoices.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
              {!agentChoices.find((a) => a.name === step.agentNames[0]) && step.agentNames[0] && (
                <option value={step.agentNames[0]}>{step.agentNames[0]}</option>
              )}
            </select>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-ink-850 bg-ink-900/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-850"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}

export type { Workflow };
