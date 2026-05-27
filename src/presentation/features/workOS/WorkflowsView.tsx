import { useEffect, useMemo, useRef, useState } from 'react';
import { AiWorkflowGenModal, AiWorkflowResumeBanner } from './AiWorkflowGenModal';
import {
  useCatalog,
  useCreateStep,
  useCreateWorkflow,
  useDeleteStep,
  useDeleteWorkflow,
  useMergeDuplicateSteps,
  useSeedPreset,
  useSteps,
  useUpdateStep,
  useUpdateWorkflow,
  useWorkflows,
} from '../../../business/workOS/use-workOS';
import { toast } from '../../shared/toast-store';
import type { Step, Workflow } from '../../../server-state/workOS';
import type { DuplicateStepGroup } from '../../../api/workOS';
import { workOSApi } from '../../../api/workOS';
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
  const { data: catalog } = useCatalog(workspaceId);
  const update = useUpdateWorkflow();
  const [editing, setEditing] = useState(false);
  const [detailStepId, setDetailStepId] = useState<string | null>(null);

  const wf = workflows.find((w) => w.id === workflowId);
  if (!wf) return <div className="p-4 text-sm text-ink-500">워크플로를 찾을 수 없습니다.</div>;

  const byId = new Map(steps.map((s) => [s.id, s]));
  const orderedSteps = wf.stepIds.map((id) => byId.get(id)).filter((s): s is Step => Boolean(s));
  const remaining = steps.filter((s) => !wf.stepIds.includes(s.id));
  const agentChoices = catalog?.agents ?? [];
  const detailStep = detailStepId ? steps.find((s) => s.id === detailStepId) ?? null : null;

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
        <div className="flex items-start gap-2">
          <input
            value={wf.name}
            onChange={(e) =>
              void update.mutateAsync({
                workspaceId,
                id: wf.id,
                patch: { name: e.target.value },
              })
            }
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
          />
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={
              'flex-shrink-0 rounded border px-2.5 py-1 text-xs font-medium transition ' +
              (editing
                ? 'border-claude-500 bg-claude-500/15 text-claude-200 hover:bg-claude-500/25'
                : 'border-ink-700 text-ink-300 hover:bg-ink-850 hover:text-white')
            }
            aria-pressed={editing}
          >
            {editing ? '✓ 편집 완료' : '✎ 편집'}
          </button>
        </div>
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
      <div
        className={
          editing ? 'grid min-h-0 flex-1 grid-cols-2' : 'flex min-h-0 flex-1 flex-col'
        }
      >
        <section
          className={
            'flex min-h-0 flex-col ' + (editing ? 'border-r border-ink-850' : '')
          }
        >
          <div className="border-b border-ink-850 bg-ink-900/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Step 순서 ({orderedSteps.length})
          </div>
          <ul className="flex-1 overflow-y-auto">
            {orderedSteps.map((step, idx) => (
              <li
                key={step.id}
                className="group flex items-center gap-2 border-b border-ink-850/50 px-3 py-2 hover:bg-ink-850/30"
              >
                <span className="w-6 text-xs text-ink-500">{idx + 1}.</span>
                <button
                  type="button"
                  onClick={() => setDetailStepId(step.id)}
                  className="min-w-0 flex-1 text-left"
                  title="클릭하여 Step 상세 보기"
                >
                  <div className="truncate text-sm text-white">{step.name}</div>
                  <div className="truncate text-xs text-ink-500">
                    {step.agentNames.join(', ')}
                  </div>
                </button>
                {editing && (
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
                )}
              </li>
            ))}
            {orderedSteps.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-ink-500">
                {editing
                  ? '오른쪽 라이브러리에서 Step을 추가하세요.'
                  : '아직 추가된 Step이 없습니다. 우상단 ‘편집’을 눌러 Step을 구성하세요.'}
              </li>
            )}
          </ul>
        </section>
        {editing && (
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
        )}
      </div>
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
  const del = useDeleteStep();

  const [draft, setDraft] = useState({ name: '', description: '', agent: '' });
  const [detailStepId, setDetailStepId] = useState<string | null>(null);
  const [dedupeOpen, setDedupeOpen] = useState(false);
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-ink-200">Step 라이브러리</div>
          <button
            type="button"
            onClick={() => setDedupeOpen(true)}
            className="rounded border border-ink-700 px-2 py-0.5 text-[11px] text-ink-300 hover:bg-ink-850 hover:text-white"
            title="이름+에이전트가 동일한 Step 들을 미리 보고 합쳐서 정리합니다."
          >
            🧹 중복 정리
          </button>
        </div>
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
              {step.description && (
                <div className="mt-0.5 truncate text-[11px] text-ink-600">
                  {step.description}
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-ink-500">
                {step.agentNames.length === 0 ? (
                  <span className="rounded bg-ink-850 px-1.5 py-0.5">에이전트 없음</span>
                ) : (
                  step.agentNames.map((name) => {
                    const isOrphan = !agentChoices.some((a) => a.name === name);
                    return (
                      <span
                        key={name}
                        className={
                          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ' +
                          (isOrphan
                            ? 'bg-amber-500/15 text-amber-200'
                            : 'bg-claude-500/15 text-claude-200')
                        }
                        title={
                          isOrphan ? '카탈로그에 없는 에이전트 (이전 데이터)' : undefined
                        }
                      >
                        {name}
                        {isOrphan && <span className="text-[10px] text-amber-400">(외부)</span>}
                      </span>
                    );
                  })
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
      {dedupeOpen && (
        <DedupeStepsModal
          workspaceId={workspaceId}
          onClose={() => setDedupeOpen(false)}
        />
      )}
    </div>
  );
}

function DedupeStepsModal({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<DuplicateStepGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // groupKey → Set<duplicateId> 선택된 항목.
  const [selection, setSelection] = useState<Map<string, Set<string>>>(new Map());
  const merge = useMergeDuplicateSteps();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await workOSApi.findDuplicateSteps({ workspaceId });
        if (cancelled) return;
        setGroups(res.groups);
        const init = new Map<string, Set<string>>();
        for (const g of res.groups) init.set(g.key, new Set(g.duplicates.map((d) => d.id)));
        setSelection(init);
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (key: string, dupId: string) => {
    setSelection((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(key) ?? []);
      if (set.has(dupId)) set.delete(dupId);
      else set.add(dupId);
      next.set(key, set);
      return next;
    });
  };

  const totalToDelete = Array.from(selection.values()).reduce((acc, s) => acc + s.size, 0);

  const handleApply = async () => {
    if (!groups || totalToDelete === 0) return;
    const payloadGroups = groups
      .map((g) => ({
        survivorId: g.survivor.id,
        duplicateIds: Array.from(selection.get(g.key) ?? []),
      }))
      .filter((g) => g.duplicateIds.length > 0);
    if (payloadGroups.length === 0) return;
    try {
      const res = await merge.mutateAsync({ workspaceId, groups: payloadGroups });
      toast.success(
        '중복 Step 정리 완료',
        `${res.deletedStepIds.length}개 삭제, 워크플로 ${res.updatedWorkflowIds.length}개 갱신.`,
      );
      onClose();
    } catch (err) {
      toast.error('중복 정리 실패', (err as Error).message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-850 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">🧹 Step 중복 정리</h2>
            <p className="mt-0.5 text-[11px] text-ink-500">
              이름(소문자/trim) + 첫 에이전트가 동일한 Step 들을 한 묶음으로 봅니다. 가장 오래된
              항목을 남기고 나머지를 삭제합니다. 워크플로의 stepIds 는 자동으로 남는 ID 로
              치환됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 rounded px-2 py-0.5 text-ink-400 hover:bg-ink-850 hover:text-white"
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loadError && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              중복 검사 실패: {loadError}
            </div>
          )}
          {!loadError && groups === null && (
            <div className="text-sm text-ink-400">중복 항목을 검사 중…</div>
          )}
          {groups && groups.length === 0 && (
            <div className="rounded border border-ink-700 bg-ink-950 px-3 py-6 text-center text-sm text-ink-400">
              중복된 Step 이 없습니다. 라이브러리는 깨끗합니다.
            </div>
          )}
          {groups && groups.length > 0 && (
            <ul className="space-y-3">
              {groups.map((g) => {
                const sel = selection.get(g.key) ?? new Set<string>();
                return (
                  <li key={g.key} className="rounded border border-ink-700 bg-ink-950 p-3">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-ink-500">
                      <span className="font-mono">{g.key}</span>
                      {g.affectedWorkflowIds.length > 0 && (
                        <span className="text-amber-300">
                          영향 워크플로 {g.affectedWorkflowIds.length}개
                        </span>
                      )}
                    </div>
                    <div className="rounded border border-claude-500/30 bg-claude-500/5 px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-claude-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-claude-100">
                          남길 항목
                        </span>
                        <span className="truncate text-sm text-white">{g.survivor.name}</span>
                        <span className="rounded bg-ink-850 px-1.5 py-0.5 text-[10px] text-ink-400">
                          {g.survivor.agentNames.length > 0
                            ? g.survivor.agentNames.join(', ')
                            : '에이전트 없음'}
                        </span>
                      </div>
                      {g.survivor.description && (
                        <p className="mt-1 text-[11px] text-ink-500">{g.survivor.description}</p>
                      )}
                    </div>
                    <ul className="mt-2 space-y-1">
                      {g.duplicates.map((d) => {
                        const checked = sel.has(d.id);
                        return (
                          <li
                            key={d.id}
                            className="flex items-start gap-2 rounded px-2 py-1 hover:bg-ink-850/40"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(g.key, d.id)}
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`truncate text-sm ${
                                    checked ? 'text-ink-500 line-through' : 'text-ink-200'
                                  }`}
                                >
                                  {d.name}
                                </span>
                                <span className="rounded bg-ink-850 px-1.5 py-0.5 text-[10px] text-ink-400">
                                  {d.agentNames.length > 0
                                    ? d.agentNames.join(', ')
                                    : '에이전트 없음'}
                                </span>
                              </div>
                              {d.description && (
                                <p className="text-[11px] text-ink-500">{d.description}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-ink-850 bg-ink-900/60 px-5 py-3">
          <span className="text-xs text-ink-400">
            {totalToDelete > 0 ? `${totalToDelete}개 Step 을 삭제합니다.` : '삭제할 항목 없음'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-850"
            >
              취소
            </button>
            <button
              type="button"
              disabled={totalToDelete === 0 || merge.isPending}
              onClick={() => void handleApply()}
              className="rounded bg-claude-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-400 disabled:opacity-40"
            >
              {merge.isPending ? '적용 중…' : '적용'}
            </button>
          </div>
        </footer>
      </div>
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
  agentChoices: { name: string; description?: string }[];
  onClose: () => void;
}) {
  const update = useUpdateStep();
  const [editing, setEditing] = useState(false);

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
        <header className="flex items-center justify-between gap-2 border-b border-ink-850 px-5 py-3">
          {editing ? (
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
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-white">
              {step.name}
            </h2>
          )}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={
              'flex-shrink-0 rounded border px-2.5 py-1 text-xs font-medium transition ' +
              (editing
                ? 'border-claude-500 bg-claude-500/15 text-claude-200 hover:bg-claude-500/25'
                : 'border-ink-700 text-ink-300 hover:bg-ink-850 hover:text-white')
            }
            aria-pressed={editing}
          >
            {editing ? '✓ 편집 완료' : '✎ 편집'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-ink-400 hover:bg-ink-850 hover:text-white"
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
            {editing ? (
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
            ) : (
              <div className="min-h-[3rem] whitespace-pre-wrap rounded border border-ink-850 bg-ink-950/50 px-3 py-2 text-sm text-ink-200">
                {step.description || (
                  <span className="text-ink-600">설명이 없습니다.</span>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              Agents {editing && <span className="text-ink-500">(복수 선택 가능)</span>}
            </label>
            {editing ? (
              <>
                <AgentMultiCombobox
                  choices={agentChoices}
                  value={step.agentNames}
                  onChange={(next) => {
                    if (next.length === 0) return;
                    void update.mutateAsync({
                      workspaceId,
                      id: step.id,
                      patch: { agentNames: next },
                    });
                  }}
                />
                <p className="mt-1 text-[11px] text-ink-500">
                  변경 시 즉시 저장됩니다. 최소 1개 이상 유지해야 합니다.
                </p>
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5 rounded border border-ink-850 bg-ink-950/50 px-3 py-2">
                {step.agentNames.length === 0 ? (
                  <span className="text-sm text-ink-600">에이전트 없음</span>
                ) : (
                  step.agentNames.map((name) => {
                    const isOrphan = !agentChoices.some((c) => c.name === name);
                    return (
                      <span
                        key={name}
                        className={
                          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] ' +
                          (isOrphan
                            ? 'bg-amber-500/15 text-amber-200'
                            : 'bg-claude-500/15 text-claude-200')
                        }
                        title={
                          isOrphan ? '카탈로그에 없는 에이전트 (이전 데이터)' : undefined
                        }
                      >
                        <span>{name}</span>
                        {isOrphan && (
                          <span className="text-[10px] text-amber-400">(외부)</span>
                        )}
                      </span>
                    );
                  })
                )}
              </div>
            )}
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

function AgentMultiCombobox({
  choices,
  value,
  onChange,
}: {
  choices: { name: string; description?: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  const selectedSet = useMemo(() => new Set(value), [value]);
  const catalogNames = useMemo(() => new Set(choices.map((c) => c.name)), [choices]);
  const orphans = useMemo(() => value.filter((n) => !catalogNames.has(n)), [value, catalogNames]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices;
    return choices.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description?.toLowerCase().includes(q) ?? false),
    );
  }, [choices, query]);

  const toggle = (name: string) => {
    const next = new Set(selectedSet);
    if (next.has(name)) {
      if (next.size <= 1) return;
      next.delete(name);
    } else {
      next.add(name);
    }
    onChange(Array.from(next));
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className="flex min-h-[36px] flex-wrap items-center gap-1 rounded border border-ink-700 bg-ink-950 px-2 py-1.5 focus-within:border-claude-500"
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {value.map((name) => {
          const isOrphan = !catalogNames.has(name);
          const removable = value.length > 1;
          return (
            <span
              key={name}
              className={
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] ' +
                (isOrphan
                  ? 'bg-amber-500/15 text-amber-200'
                  : 'bg-claude-500/15 text-claude-200')
              }
              title={isOrphan ? '카탈로그에 없는 에이전트 (이전 데이터)' : undefined}
            >
              <span>{name}</span>
              {isOrphan && <span className="text-[10px] text-amber-400">(외부)</span>}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (removable) toggle(name);
                }}
                disabled={!removable}
                className="rounded text-ink-400 hover:bg-ink-800 hover:text-white disabled:opacity-30"
                aria-label={`${name} 제거`}
              >
                ✕
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? '에이전트 검색…' : '추가 검색…'}
          className="min-w-[120px] flex-1 bg-transparent px-1 text-sm text-ink-200 outline-none placeholder:text-ink-500"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded border border-ink-700 bg-ink-950 shadow-lg">
          {orphans.length > 0 && (
            <div className="border-b border-ink-850/70 px-2 py-1 text-[10px] uppercase tracking-wide text-amber-400">
              카탈로그 외 (이전 데이터)
            </div>
          )}
          {orphans.map((name) => (
            <button
              key={`orphan-${name}`}
              type="button"
              onClick={() => toggle(name)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm text-amber-200 hover:bg-ink-850/60"
            >
              <span className="text-[11px] text-claude-300">✓</span>
              <span className="flex-1 truncate">{name}</span>
              <span className="text-[10px] text-amber-400">(외부)</span>
            </button>
          ))}
          {filtered.length === 0 && choices.length > 0 && (
            <p className="px-2 py-2 text-xs text-ink-500">검색 결과가 없습니다.</p>
          )}
          {choices.length === 0 && (
            <p className="px-2 py-2 text-xs text-ink-500">에이전트 카탈로그가 비어 있습니다.</p>
          )}
          {filtered.map((a) => {
            const checked = selectedSet.has(a.name);
            return (
              <button
                key={a.name}
                type="button"
                onClick={() => toggle(a.name)}
                className={
                  'flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-ink-850/60 ' +
                  (checked ? 'text-claude-200' : 'text-ink-200')
                }
              >
                <span
                  className={
                    'inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] ' +
                    (checked
                      ? 'border-claude-400 bg-claude-500/30 text-claude-100'
                      : 'border-ink-600')
                  }
                >
                  {checked ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{a.name}</span>
                  {a.description && (
                    <span className="block truncate text-[11px] text-ink-500">
                      {a.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { Workflow };
