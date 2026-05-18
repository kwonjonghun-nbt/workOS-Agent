import { useMemo, useState } from 'react';
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
    <div className="flex h-full flex-col border-r border-slate-800 bg-slate-900/40">
      <AiWorkflowResumeBanner workspaceId={workspaceId} onResume={() => setAiModalOpen(true)} />
      <div className="border-b border-slate-800 p-2">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          워크플로
        </div>
        <button
          type="button"
          onClick={() => setAiModalOpen(true)}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
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
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="rounded bg-emerald-500/90 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-emerald-400"
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
                ? 'bg-slate-800 text-emerald-300'
                : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-300'
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
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(w.id)}
                className="flex-1 truncate text-left"
                title={w.description}
              >
                {w.name}
                <span className="ml-2 text-xs text-slate-500">{w.stepIds.length} steps</span>
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
                className="opacity-0 group-hover:opacity-100 ml-1 rounded px-1 text-slate-400 hover:bg-slate-700 hover:text-white"
                aria-label={`Delete ${w.name}`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
        {workflows.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-slate-500">
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
      className="mt-3 block w-full rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
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
  if (!wf) return <div className="p-4 text-sm text-slate-500">워크플로를 찾을 수 없습니다.</div>;

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
      <div className="border-b border-slate-800 p-3">
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
          className="mt-2 w-full resize-none rounded border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-300 outline-none focus:border-emerald-500"
          rows={2}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <section className="flex min-h-0 flex-col border-r border-slate-800">
          <div className="border-b border-slate-800 bg-slate-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Step 순서 ({orderedSteps.length})
          </div>
          <ul className="flex-1 overflow-y-auto">
            {orderedSteps.map((step, idx) => (
              <li
                key={step.id}
                className="group flex items-center gap-2 border-b border-slate-800/50 px-3 py-2"
              >
                <span className="w-6 text-xs text-slate-500">{idx + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-100">{step.name}</div>
                  <div className="truncate text-xs text-slate-500">
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
              <li className="px-3 py-4 text-center text-xs text-slate-500">
                오른쪽 라이브러리에서 Step을 추가하세요.
              </li>
            )}
          </ul>
        </section>
        <section className="flex min-h-0 flex-col">
          <div className="border-b border-slate-800 bg-slate-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Step 라이브러리 — 클릭해서 추가
          </div>
          <ul className="flex-1 overflow-y-auto">
            {remaining.map((step) => (
              <li
                key={step.id}
                className="border-b border-slate-800/50 px-3 py-2 hover:bg-slate-800/40"
              >
                <button
                  type="button"
                  onClick={() => append(step.id)}
                  className="w-full text-left"
                >
                  <div className="text-sm text-slate-100">+ {step.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {step.agentNames.join(', ')}
                  </div>
                </button>
              </li>
            ))}
            {remaining.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-slate-500">
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
      className="rounded px-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
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
  const agentChoices = useMemo(() => catalog?.agents ?? [], [catalog]);

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
      <div className="border-b border-slate-800 p-3">
        <div className="mb-2 text-sm font-semibold text-slate-200">Step 라이브러리</div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Step 이름 (예: API 레이어 개발)"
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-emerald-500"
          />
          <select
            value={draft.agent}
            onChange={(e) => setDraft((d) => ({ ...d, agent: e.target.value }))}
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-emerald-500"
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
            className="rounded bg-emerald-500/90 px-3 py-1 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
            disabled={!draft.name.trim() || (!draft.agent && agentChoices.length === 0)}
          >
            Step 추가
          </button>
        </div>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="이 Step의 책임 / 분해 프롬프트에 주입될 설명"
          className="mt-2 w-full resize-none rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-emerald-500"
          rows={2}
        />
        {agentChoices.length === 0 && (
          <p className="mt-1 text-xs text-amber-400">
            ⚠ <code>.claude/agents/</code> 에서 에이전트를 찾지 못했습니다. 좌측 셀렉트가 비어 있다면
            직접 텍스트 박스로 입력해야 합니다.
          </p>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto">
        {steps.map((step) => (
          <li key={step.id} className="border-b border-slate-800/50 px-3 py-2">
            <div className="flex items-center justify-between">
              <input
                value={step.name}
                onChange={(e) =>
                  void update.mutateAsync({
                    workspaceId,
                    id: step.id,
                    patch: { name: e.target.value },
                  })
                }
                className="flex-1 bg-transparent text-sm font-medium text-slate-100 outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`'${step.name}' Step을 삭제할까요?`)) {
                    void del.mutateAsync({ workspaceId, id: step.id });
                  }
                }}
                className="ml-2 rounded px-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
              <textarea
                value={step.description}
                onChange={(e) =>
                  void update.mutateAsync({
                    workspaceId,
                    id: step.id,
                    patch: { description: e.target.value },
                  })
                }
                placeholder="이 Step의 책임"
                rows={2}
                className="resize-none rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-300 outline-none focus:border-emerald-500"
              />
              <select
                value={step.agentNames[0] ?? ''}
                onChange={(e) =>
                  void update.mutateAsync({
                    workspaceId,
                    id: step.id,
                    patch: { agentNames: [e.target.value] },
                  })
                }
                className="rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-emerald-500"
              >
                {agentChoices.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
                {!agentChoices.find((a) => a.name === step.agentNames[0]) && (
                  <option value={step.agentNames[0]}>{step.agentNames[0]}</option>
                )}
              </select>
            </div>
          </li>
        ))}
        {steps.length === 0 && (
          <li className="px-3 py-8 text-center text-xs text-slate-500">
            아직 Step이 없습니다. 위에서 첫 Step을 만들어 보세요.
          </li>
        )}
      </ul>
    </div>
  );
}

export type { Workflow };
