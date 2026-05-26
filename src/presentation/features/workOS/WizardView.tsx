import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useWizardApproveProposal,
  useWizardProceedNext,
  useWizardRejectProposal,
  useWizardReset,
  useWizardSendMessage,
  useWizardSession,
} from '../../../business/wizard/use-wizard';
import {
  useSteps,
  useTaskItems,
  useTasks,
  useWorkflows,
} from '../../../business/workOS/use-workOS';
import { useWorkOSStore } from '../../../business/workOS/workOS-store';
import type {
  WizardAction,
  WizardMessage,
  WizardSession,
} from '../../../server-state/wizard';
import type { Step, TaskItem } from '../../../server-state/workOS';
import { toast } from '../../shared/toast-store';

type Props = { workspaceId: string };

export function WizardView({ workspaceId }: Props) {
  const { data: session, isLoading } = useWizardSession(workspaceId);
  const send = useWizardSendMessage();
  const approve = useWizardApproveProposal();
  const reject = useWizardRejectProposal();
  const proceed = useWizardProceedNext();
  const reset = useWizardReset();
  const selectTask = useWorkOSStore((s) => s.selectTask);
  const setView = useWorkOSStore((s) => s.setView);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 새 메시지가 추가될 때마다 스크롤 하단으로 — 채팅 UX 의 기본.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [session?.messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    try {
      await send.mutateAsync({ workspaceId, text });
    } catch (err) {
      toast.error('메시지 전송 실패', (err as Error).message);
    }
  };

  const runAction = async (action: WizardAction) => {
    try {
      switch (action.kind) {
        case 'approve-proposal':
          await approve.mutateAsync({ workspaceId });
          break;
        case 'reject-proposal':
          await reject.mutateAsync({ workspaceId });
          break;
        case 'proceed-next':
          await proceed.mutateAsync({ workspaceId });
          break;
        case 'show-progress':
          await send.mutateAsync({ workspaceId, text: '/상황' });
          break;
        case 'reset':
          if (!window.confirm('대화 기록을 초기화하고 새로 시작할까요?')) return;
          await reset.mutateAsync({ workspaceId });
          break;
        case 'open-task':
          selectTask(workspaceId, action.taskId);
          setView(workspaceId, 'tasks');
          break;
      }
    } catch (err) {
      toast.error('처리 실패', (err as Error).message);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-900">
      <Header session={session ?? null} onReset={() => runAction({ kind: 'reset' })} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {isLoading && (
              <div className="text-sm text-ink-500">대화를 불러오는 중…</div>
            )}
            {session && (
              <ul className="mx-auto flex max-w-3xl flex-col gap-3">
                {session.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} onAction={runAction} />
                ))}
              </ul>
            )}
          </div>
          <Composer
            value={input}
            onChange={setInput}
            onSubmit={() => void handleSend()}
            disabled={send.isPending}
            onShortcut={(cmd) => {
              setInput('');
              void send.mutateAsync({ workspaceId, text: cmd }).catch((err) => {
                toast.error('처리 실패', (err as Error).message);
              });
            }}
          />
        </div>
        {session?.currentTaskId && (
          <ProgressPanel
            workspaceId={workspaceId}
            taskId={session.currentTaskId}
            currentItemId={session.currentItemId}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 오른쪽 사이드 — 현재 Task 의 단계 진행 상황 (인라인 FlowBoard).
 * 진행률 + 각 TaskItem 의 상태 라인. 클릭 시 Tasks 탭으로 deep-link.
 */
function ProgressPanel({
  workspaceId,
  taskId,
  currentItemId,
}: {
  workspaceId: string;
  taskId: string;
  currentItemId?: string;
}) {
  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: items = [] } = useTaskItems(workspaceId);
  const { data: workflows = [] } = useWorkflows(workspaceId);
  const { data: steps = [] } = useSteps(workspaceId);
  const selectTask = useWorkOSStore((s) => s.selectTask);
  const setView = useWorkOSStore((s) => s.setView);

  const task = tasks.find((t) => t.id === taskId);
  const workflow = task ? workflows.find((w) => w.id === task.workflowId) : null;
  const myItems: TaskItem[] = useMemo(
    () =>
      task
        ? task.taskItemIds
            .map((id) => items.find((i) => i.id === id))
            .filter((i): i is TaskItem => Boolean(i))
        : [],
    [task, items],
  );
  const stepById = useMemo(() => new Map(steps.map((s) => [s.id, s] as const)), [steps]);

  if (!task) return null;
  const done = myItems.filter((i) => i.status === 'completed').length;
  const total = myItems.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-ink-850 bg-ink-900/60 md:flex">
      <div className="border-b border-ink-850 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
          진행 상황
        </div>
        <div className="mt-0.5 truncate text-sm font-semibold text-white" title={task.title}>
          {task.title}
        </div>
        {workflow && (
          <div className="truncate text-[11px] text-ink-500" title={workflow.name}>
            {workflow.name}
          </div>
        )}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-ink-400">
            <span>
              {done}/{total} 완료
            </span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-ink-850">
            <div
              className="h-full bg-claude-500/80 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            selectTask(workspaceId, taskId);
            setView(workspaceId, 'tasks');
          }}
          className="mt-2 w-full rounded border border-ink-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-ink-850 hover:text-white"
        >
          → 전체 보드 열기
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {myItems.length === 0 && (
          <li className="rounded border border-dashed border-ink-850 px-2 py-3 text-center text-[11px] text-ink-600">
            아직 분해되지 않았습니다.
          </li>
        )}
        {myItems.map((item, idx) => (
          <ProgressRow
            key={item.id}
            idx={idx + 1}
            item={item}
            step={stepById.get(item.stepId) ?? null}
            isCurrent={item.id === currentItemId}
          />
        ))}
      </ul>
    </aside>
  );
}

function ProgressRow({
  idx,
  item,
  step,
  isCurrent,
}: {
  idx: number;
  item: TaskItem;
  step: Step | null;
  isCurrent: boolean;
}) {
  const chip = STATUS_CHIP[item.status];
  return (
    <li
      className={`mb-1 rounded border px-2 py-1.5 ${
        isCurrent
          ? 'border-claude-500/60 bg-claude-500/5'
          : 'border-ink-850/60 bg-ink-900/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="w-5 text-[10px] text-ink-500">{idx}.</span>
        <span
          className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1 text-[10px] font-bold ${chip.cls}`}
          title={chip.label}
        >
          {chip.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-100">{item.name}</span>
      </div>
      {step && (
        <div className="ml-7 truncate text-[10px] text-ink-500">{step.name}</div>
      )}
    </li>
  );
}

const STATUS_CHIP: Record<TaskItem['status'], { icon: string; cls: string; label: string }> = {
  pending: { icon: '○', cls: 'bg-ink-800 text-ink-400 border-ink-700', label: '대기' },
  running: {
    icon: '▶',
    cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
    label: '실행중',
  },
  completed: {
    icon: '✓',
    cls: 'bg-claude-500/15 text-claude-300 border-claude-500/40',
    label: '완료',
  },
  failed: { icon: '✕', cls: 'bg-red-500/15 text-red-300 border-red-500/40', label: '실패' },
  skipped: { icon: '–', cls: 'bg-ink-800 text-ink-500 border-ink-700', label: '건너뜀' },
};

function Header({
  session,
  onReset,
}: {
  session: WizardSession | null;
  onReset: () => void;
}) {
  const phaseLabel = useMemo(() => {
    if (!session) return '';
    return phaseLabelOf(session.phase);
  }, [session]);
  return (
    <div className="flex items-center justify-between border-b border-ink-850 bg-ink-900/70 px-4 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-sm">🤖</span>
        <span className="font-semibold text-ink-200">자비스 위저드</span>
        {phaseLabel && (
          <span className="rounded bg-ink-850 px-1.5 py-0.5 text-[10px] text-ink-400">
            {phaseLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-ink-700 px-2 py-0.5 text-[11px] text-ink-300 hover:bg-ink-850 hover:text-white"
          title="대화 초기화"
        >
          ↺ 새로 시작
        </button>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onAction,
}: {
  message: WizardMessage;
  onAction: (a: WizardAction) => void;
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  return (
    <li className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-claude-500/20 text-claude-100'
            : isSystem
              ? 'border border-ink-700 bg-ink-850/60 text-ink-300'
              : 'bg-ink-850 text-ink-100'
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{message.text}</div>
        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.actions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onAction(a)}
                className="rounded border border-claude-500/40 bg-claude-500/10 px-2 py-0.5 text-[11px] font-medium text-claude-200 hover:bg-claude-500/20"
              >
                {actionLabel(a)}
              </button>
            ))}
          </div>
        )}
        <div className="mt-1 text-[10px] text-ink-500">{formatTime(message.at)}</div>
      </div>
    </li>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  onShortcut,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onShortcut: (cmd: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="border-t border-ink-850 bg-ink-900/70 p-3">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <ShortcutChip onClick={() => onShortcut('/상황')}>📊 현재 상황</ShortcutChip>
          <ShortcutChip onClick={() => onShortcut('/다음')}>▶ 다음 진행</ShortcutChip>
          <ShortcutChip onClick={() => onShortcut('/도움')}>? 도움말</ShortcutChip>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="보스, 어떤 걸 도와드릴까요? 요구사항·지라 링크·자유설명을 적어주세요. (⌘+Enter 전송)"
            className="min-h-[44px] flex-1 resize-none rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-white outline-none focus:border-claude-500"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            className="rounded bg-claude-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-claude-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            보내기
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutChip({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-ink-700 bg-ink-850/40 px-2.5 py-0.5 text-[11px] text-ink-300 hover:border-ink-500 hover:text-white"
    >
      {children}
    </button>
  );
}

function phaseLabelOf(phase: WizardSession['phase']): string {
  switch (phase) {
    case 'idle':
      return '대기';
    case 'gathering':
      return '요구사항 수집';
    case 'proposing':
      return '제안 검토 대기';
    case 'executing':
      return '실행 중';
    case 'reviewing':
      return '검토 대기';
    case 'done':
      return '완료';
  }
}

function actionLabel(a: WizardAction): string {
  switch (a.kind) {
    case 'approve-proposal':
      return '✓ 시작';
    case 'reject-proposal':
      return '✗ 다른 워크플로';
    case 'proceed-next':
      return '▶ 다음 진행';
    case 'show-progress':
      return '📊 진행상황';
    case 'reset':
      return '↺ 초기화';
    case 'open-task':
      return '→ Task 열기';
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
