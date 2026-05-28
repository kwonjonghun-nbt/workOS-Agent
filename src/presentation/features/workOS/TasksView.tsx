import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  useCreateTask,
  useDecomposeTask,
  useRefreshJiraTaskStatus,
  useDeleteTask,
  useDeleteTaskItem,
  useExecuteTaskItem,
  useImportDecomposition,
  useRequestAiDecompose,
  useSeedPreset,
  useSteps,
  useTaskItems,
  useTasks,
  useUpdateTask,
  useUpdateTaskItem,
  useWorkflows,
} from '../../../business/workOS/use-workOS';
import type { Step, Task, TaskItem } from '../../../server-state/workOS';
import { jiraMutations, jiraQueries } from '../../../server-state/jira';
import { useWorkOSStore } from '../../../business/workOS/workOS-store';
import { useWorkspaceStore } from '../../../business/workspace/workspace-store';
import { useWorkspaceList } from '../../../business/workspace/use-workspace';
import { getLocal, setLocal } from '../../../api/local-store';
import { Split } from '../../shared/Split';
import { toast } from '../../shared/toast-store';

type Props = { workspaceId: string };

type ItemStatus = TaskItem['status'];

type TaskBoardViewMode = 'kanban' | 'flow';

const TASK_BOARD_VIEW_STORAGE_KEY = 'workOS:tasks:viewMode';

function useTaskBoardViewMode(): [TaskBoardViewMode, (mode: TaskBoardViewMode) => void] {
  const [mode, setMode] = useState<TaskBoardViewMode>(() => {
    const saved = getLocal(TASK_BOARD_VIEW_STORAGE_KEY);
    return saved === 'flow' || saved === 'kanban' ? saved : 'kanban';
  });
  const update = (next: TaskBoardViewMode) => {
    setMode(next);
    setLocal(TASK_BOARD_VIEW_STORAGE_KEY, next);
  };
  return [mode, update];
}

const KANBAN_COLUMNS: { status: ItemStatus; label: string; tone: string }[] = [
  { status: 'pending', label: '대기', tone: 'border-ink-700 bg-ink-850/30' },
  { status: 'running', label: '실행중', tone: 'border-blue-500/40 bg-blue-500/5' },
  { status: 'completed', label: '완료', tone: 'border-claude-500/40 bg-claude-500/5' },
  { status: 'failed', label: '실패', tone: 'border-red-500/40 bg-red-500/5' },
  { status: 'skipped', label: '건너뜀', tone: 'border-ink-700 bg-ink-900/40' },
];

export function TasksView({ workspaceId }: Props) {
  const selectedTaskId = useWorkOSStore((s) => s.selectedTaskByWorkspace[workspaceId] ?? null);
  const selectTask = useWorkOSStore((s) => s.selectTask);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  return (
    <>
      <Split direction="horizontal" initialFirstSize={28} minFirstSize={18} maxFirstSize={50}>
        <TaskSidebar
          workspaceId={workspaceId}
          selectedTaskId={selectedTaskId}
          onSelect={(id) => selectTask(workspaceId, id)}
          onNewTask={() => setNewTaskOpen(true)}
        />
        <div className="h-full min-h-0">
          {selectedTaskId ? (
            <TaskDetail workspaceId={workspaceId} taskId={selectedTaskId} />
          ) : (
            <EmptyTaskPane
              workspaceId={workspaceId}
              onNewTask={() => setNewTaskOpen(true)}
            />
          )}
        </div>
      </Split>
      {newTaskOpen && (
        <NewTaskModal
          workspaceId={workspaceId}
          onClose={() => setNewTaskOpen(false)}
          onCreated={(taskId) => {
            selectTask(workspaceId, taskId);
            setNewTaskOpen(false);
          }}
        />
      )}
    </>
  );
}

function EmptyTaskPane({
  workspaceId,
  onNewTask,
}: {
  workspaceId: string;
  onNewTask: () => void;
}) {
  const seed = useSeedPreset();
  const { data: workflows = [] } = useWorkflows(workspaceId);
  const hasAnyWorkflow = workflows.length > 0;

  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-ink-500">
      <div className="max-w-md space-y-3">
        <div className="text-lg text-ink-300">왼쪽에서 Task를 선택하거나 새로 만드세요</div>
        <div>
          새 Task 는 <strong>제목 + 분해 프롬프트</strong> 를 한 번에 입력해 만듭니다.
          만든 뒤엔 칸반으로 실행 단위(TaskItem)를 관리합니다.
        </div>
        {hasAnyWorkflow ? (
          <button
            type="button"
            onClick={onNewTask}
            className="mt-3 rounded bg-claude-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-claude-400"
          >
            ＋ 새 Task 만들기
          </button>
        ) : (
          <div className="mt-6 rounded border border-claude-500/30 bg-claude-500/5 p-4 text-left">
            <div className="mb-2 text-sm font-semibold text-claude-300">💡 첫 사용자 가이드</div>
            <p className="mb-3 text-xs text-ink-400">
              아직 워크플로가 없습니다. 한 번에 12-step 프론트엔드 샘플 워크플로를 만들고
              시작하세요.
            </p>
            <button
              type="button"
              disabled={seed.isPending}
              onClick={async () => {
                try {
                  await seed.mutateAsync({ workspaceId });
                  toast.success('샘플 워크플로 생성 완료', '이제 새 Task 를 만들 수 있습니다.');
                } catch {
                  /* mutation cache가 토스트 처리 */
                }
              }}
              className="w-full rounded bg-claude-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-claude-400 disabled:opacity-50"
            >
              {seed.isPending ? '생성 중…' : '✨ 샘플 워크플로 한 번에 만들기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskSidebar({
  workspaceId,
  selectedTaskId,
  onSelect,
  onNewTask,
}: {
  workspaceId: string;
  selectedTaskId: string | null;
  onSelect: (id: string | null) => void;
  onNewTask: () => void;
}) {
  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: workflows = [] } = useWorkflows(workspaceId);
  const del = useDeleteTask();

  return (
    <div className="flex h-full flex-col border-r border-ink-850 bg-ink-900/40">
      <div className="border-b border-ink-850 p-2">
        <button
          type="button"
          onClick={onNewTask}
          disabled={workflows.length === 0}
          className="w-full rounded bg-claude-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-claude-400 disabled:cursor-not-allowed disabled:opacity-40"
          title={workflows.length === 0 ? '워크플로를 먼저 만들어 주세요.' : '새 Task 생성'}
        >
          ＋ 새 Task
        </button>
        {workflows.length === 0 && (
          <p className="mt-1 text-[10px] text-amber-300">
            ⚠ 워크플로가 없습니다. ‘워크플로’ 탭에서 먼저 만들어주세요.
          </p>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto">
        {tasks
          .slice()
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              workflowName={workflows.find((w) => w.id === t.workflowId)?.name ?? '?'}
              active={t.id === selectedTaskId}
              onSelect={() => onSelect(t.id)}
              onDelete={() => {
                if (window.confirm(`'${t.title}' Task를 삭제할까요?`)) {
                  void del.mutateAsync({ workspaceId, id: t.id }).then(() => {
                    if (selectedTaskId === t.id) onSelect(null);
                  });
                }
              }}
            />
          ))}
        {tasks.length === 0 && (
          <li className="px-3 py-4 text-center text-xs text-ink-500">
            아직 Task가 없습니다. 위 ‘＋ 새 Task’ 를 눌러보세요.
          </li>
        )}
      </ul>
    </div>
  );
}

function TaskRow({
  task,
  workflowName,
  active,
  onSelect,
  onDelete,
}: {
  task: Task;
  workflowName: string;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <li>
      <div
        className={`group flex items-start gap-2 border-b border-ink-850/50 px-3 py-2 text-sm ${
          active ? 'bg-ink-850 text-white' : 'text-ink-300 hover:bg-ink-850/60'
        }`}
      >
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="truncate">{task.title}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
            <span className="rounded bg-ink-850 px-1.5 py-0.5">{workflowName}</span>
            <StatusBadge status={task.status} />
            <span className="text-ink-600">{task.taskItemIds.length}개 단계</span>
          </div>
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 rounded px-1 text-ink-400 hover:bg-ink-700 hover:text-white"
          aria-label="Delete task"
        >
          ✕
        </button>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: Task['status'] | TaskItem['status'] }) {
  const map: Record<string, string> = {
    pending: 'bg-ink-700 text-ink-300',
    in_progress: 'bg-amber-500/20 text-amber-300',
    running: 'bg-blue-500/20 text-blue-300',
    completed: 'bg-claude-500/20 text-claude-300',
    failed: 'bg-red-500/20 text-red-300',
    archived: 'bg-ink-700 text-ink-400',
    skipped: 'bg-ink-700 text-ink-400',
  };
  const label: Record<string, string> = {
    pending: '대기',
    in_progress: '진행중',
    running: '실행중',
    completed: '완료',
    failed: '실패',
    archived: '보관됨',
    skipped: '건너뜀',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${map[status] ?? ''}`}>
      {label[status] ?? status}
    </span>
  );
}

/**
 * 새 Task 생성 모달 — 제목 + 워크플로 + 분해 프롬프트(요구사항) 를 한 번에 입력.
 * 생성 직후 자동으로 분해(빠른 분해 / AI 분해)까지 트리거할 수 있다.
 */
function NewTaskModal({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (taskId: string) => void;
}) {
  const { data: workflows = [] } = useWorkflows(workspaceId);
  const { data: workspaces = [] } = useWorkspaceList();
  const create = useCreateTask();
  const decompose = useDecomposeTask();
  const aiDecompose = useRequestAiDecompose();
  const updateTask = useUpdateTask();
  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);
  const setTerminalPanelOpen = useWorkspaceStore((s) => s.setTerminalPanelOpen);

  const [title, setTitle] = useState('');
  const [workflowId, setWorkflowId] = useState<string>(workflows[0]?.id ?? '');
  const [requirement, setRequirement] = useState('');
  const [mode, setMode] = useState<'none' | 'quick' | 'ai'>('ai');
  const [submitting, setSubmitting] = useState(false);

  // Jira 관련 상태
  const [jiraParentMode, setJiraParentMode] = useState<'existing' | 'new'>('existing');
  const [jiraParentKey, setJiraParentKey] = useState('');
  const [jiraParentKeyConfirmed, setJiraParentKeyConfirmed] = useState('');
  const [jiraNewSummary, setJiraNewSummary] = useState('');
  const [jiraNewDescription, setJiraNewDescription] = useState('');
  const [jiraChildMode, setJiraChildMode] = useState<'all' | 'explicit' | 'future-only'>('all');
  const [jiraChildKeysText, setJiraChildKeysText] = useState('');
  const createJiraIssue = useMutation(jiraMutations.createIssue());
  const { data: jiraChildrenData } = useQuery(
    jiraQueries.issueChildren(jiraParentKeyConfirmed),
  );

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const workspaceTaskSource = workspace?.taskSource ?? 'local';
  const workspaceJiraDefaultIssueType = workspace?.jiraDefaultIssueType;
  const isJiraWorkflow = workspaceTaskSource === 'jira';

  useEffect(() => {
    if (!workflowId && workflows[0]) setWorkflowId(workflows[0].id);
  }, [workflows, workflowId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  const canSubmit = title.trim().length > 0 && workflowId && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let resolvedJiraParentKey: string | undefined;
      if (isJiraWorkflow) {
        if (jiraParentMode === 'existing') {
          resolvedJiraParentKey = jiraParentKey.trim() || undefined;
        } else {
          if (jiraNewSummary.trim()) {
            const issueType = workspaceJiraDefaultIssueType ?? 'Story';
            const created_issue = await createJiraIssue.mutateAsync({
              summary: jiraNewSummary.trim(),
              issueType,
              description: jiraNewDescription.trim() || undefined,
            });
            resolvedJiraParentKey = created_issue.key;
          }
        }
      }

      let resolvedExplicitChildKeys: string[] | undefined;
      if (isJiraWorkflow && jiraChildMode === 'explicit') {
        resolvedExplicitChildKeys = jiraChildKeysText
          .split(/[\s,]+/)
          .map((k) => k.trim())
          .filter((k) => k.length > 0);
      }

      const created = await create.mutateAsync({
        workspaceId,
        workflowId,
        title: title.trim(),
        requirement: requirement.trim() || undefined,
        jiraParentKey: resolvedJiraParentKey,
        jiraChildMode: isJiraWorkflow ? jiraChildMode : undefined,
        jiraExplicitChildKeys: resolvedExplicitChildKeys,
      });

      // createTask 응답에 requirement 가 반영되지 않을 수 있어 한 번 더 보강.
      if (requirement.trim()) {
        try {
          await updateTask.mutateAsync({
            workspaceId,
            id: created.id,
            patch: { requirement: requirement.trim() },
          });
        } catch {
          /* best effort */
        }
      }

      if (mode === 'quick') {
        try {
          const items = await decompose.mutateAsync({ workspaceId, taskId: created.id });
          toast.success(
            '분해 완료',
            `${items.length}개의 TaskItem 이 생성되었습니다.`,
          );
        } catch {
          /* */
        }
      } else if (mode === 'ai') {
        if (!requirement.trim()) {
          toast.warning(
            'AI 분해 건너뜀',
            '요구사항이 비어 있어 자동 AI 분해를 실행하지 않았습니다.',
          );
        } else {
          try {
            setTerminalPanelOpen(workspaceId, true);
            const res = await aiDecompose.mutateAsync({ workspaceId, taskId: created.id });
            setActiveTerminal(workspaceId, res.sessionId);
            toast.info(
              '🧠 AI 분해 시작됨',
              '터미널에서 진행을 확인한 뒤 상세 화면의 “결과 가져오기” 를 누르세요.',
            );
          } catch {
            /* */
          }
        }
      }

      onCreated(created.id);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-850 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-white">＋ 새 Task</h2>
            <p className="text-xs text-ink-400">
              제목과 분해 프롬프트(요구사항)를 한 번에 입력하면 Task 생성 + 분해까지 한 단계로 진행됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="rounded px-2 py-0.5 text-ink-400 hover:bg-ink-850 hover:text-white"
            aria-label="닫기"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              제목
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 결제 페이지 구현"
              className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-claude-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              워크플로
            </label>
            <select
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-claude-500"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {isJiraWorkflow && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                Jira 부모 티켓
              </label>
              <div className="flex gap-3 text-xs mb-2">
                {(['existing', 'new'] as const).map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-1">
                    <input
                      type="radio"
                      name="jiraParentMode"
                      value={m}
                      checked={jiraParentMode === m}
                      onChange={() => setJiraParentMode(m)}
                      className="accent-claude-500"
                    />
                    <span className="text-ink-300">
                      {m === 'existing' ? '기존 티켓 사용' : '새 티켓 생성'}
                    </span>
                  </label>
                ))}
              </div>
              {jiraParentMode === 'existing' ? (
                <div className="flex gap-2">
                  <input
                    value={jiraParentKey}
                    onChange={(e) => setJiraParentKey(e.target.value)}
                    placeholder="예: PROJ-123"
                    className="flex-1 rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-claude-500"
                  />
                  <button
                    type="button"
                    onClick={() => setJiraParentKeyConfirmed(jiraParentKey.trim())}
                    disabled={!jiraParentKey.trim()}
                    className="rounded border border-ink-700 px-3 py-2 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-40"
                  >
                    확인
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    value={jiraNewSummary}
                    onChange={(e) => setJiraNewSummary(e.target.value)}
                    placeholder={`새 ${workspaceJiraDefaultIssueType ?? 'Story'} 제목`}
                    className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-claude-500"
                  />
                  <textarea
                    value={jiraNewDescription}
                    onChange={(e) => setJiraNewDescription(e.target.value)}
                    placeholder="설명 (선택)"
                    rows={2}
                    className="w-full resize-none rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-claude-500"
                  />
                </div>
              )}
              {jiraParentMode === 'existing' && jiraParentKeyConfirmed && jiraChildrenData && (
                <div className="mt-2 rounded border border-ink-700 bg-ink-950 px-3 py-2 text-xs">
                  <div className="font-medium text-ink-200">
                    [{jiraChildrenData.parent.key}] {jiraChildrenData.parent.summary}
                  </div>
                  <div className="mt-1 text-ink-500">
                    자식 {jiraChildrenData.children.length}개
                  </div>
                </div>
              )}

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                  자식 티켓 가져오기 모드
                </label>
                <div className="flex flex-wrap gap-3 text-xs mb-2">
                  {(
                    [
                      ['all', '전부'],
                      ['explicit', '수동 지정'],
                      ['future-only', '이후 새로 생성된 것만'],
                    ] as const
                  ).map(([m, label]) => (
                    <label key={m} className="flex cursor-pointer items-center gap-1">
                      <input
                        type="radio"
                        name="jiraChildMode"
                        value={m}
                        checked={jiraChildMode === m}
                        onChange={() => setJiraChildMode(m)}
                        className="accent-claude-500"
                      />
                      <span className="text-ink-300">{label}</span>
                    </label>
                  ))}
                </div>
                {jiraChildMode === 'explicit' && (
                  <textarea
                    value={jiraChildKeysText}
                    onChange={(e) => setJiraChildKeysText(e.target.value)}
                    placeholder="예: PROJ-101, PROJ-102, PROJ-103"
                    rows={2}
                    className="w-full resize-none rounded border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-xs text-white outline-none focus:border-claude-500"
                  />
                )}
                <p className="mt-1 text-[11px] text-ink-500">
                  {jiraChildMode === 'all' && '부모 에픽 아래의 모든 자식을 TaskItem 으로 가져옵니다.'}
                  {jiraChildMode === 'explicit' &&
                    '입력한 자식 키만 TaskItem 으로 가져옵니다 (콤마/공백 구분).'}
                  {jiraChildMode === 'future-only' &&
                    '빈 상태로 시작하고, 워크플로 실행 중 새로 생성된 자식만 자동 attach 됩니다.'}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              요구사항 / 분해 프롬프트
            </label>
            <textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder={
                '여기에 요구사항·Swagger·Figma 링크·시나리오 등을 자유롭게 적으세요.\n분해 시 각 TaskItem 의 컨텍스트로 사용됩니다.'
              }
              rows={10}
              className="w-full resize-y rounded border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-claude-500"
            />
            <p className="mt-1 text-[11px] text-ink-500">
              비워두면 Task 만 만들고 실행 단위는 나중에 분해할 수 있습니다.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              생성 직후 동작
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <ModeChoice
                value="ai"
                current={mode}
                onSelect={setMode}
                label="🧠 AI 분해"
                desc="요구사항을 Claude CLI 로 보내 자동 분해 시작"
              />
              <ModeChoice
                value="quick"
                current={mode}
                onSelect={setMode}
                label="⚡ 빠른 분해"
                desc="스텝당 1 TaskItem 결정적 생성"
              />
              <ModeChoice
                value="none"
                current={mode}
                onSelect={setMode}
                label="생성만"
                desc="분해는 나중에 직접"
              />
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-ink-850 bg-ink-900/60 px-5 py-3">
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="rounded border border-ink-700 px-3 py-1.5 text-sm text-ink-300 hover:bg-ink-850 disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className="rounded bg-claude-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? '생성 중…' : '생성하기'}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ModeChoice({
  value,
  current,
  onSelect,
  label,
  desc,
}: {
  value: 'none' | 'quick' | 'ai';
  current: 'none' | 'quick' | 'ai';
  onSelect: (v: 'none' | 'quick' | 'ai') => void;
  label: string;
  desc: string;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`rounded border px-2 py-2 text-left ${
        active
          ? 'border-claude-500/60 bg-claude-500/10 text-claude-300'
          : 'border-ink-700 bg-ink-900/40 text-ink-300 hover:border-ink-500'
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-0.5 text-[11px] text-ink-500">{desc}</div>
    </button>
  );
}

function TaskDetail({ workspaceId, taskId }: { workspaceId: string; taskId: string }) {
  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: items = [] } = useTaskItems(workspaceId);
  const { data: steps = [] } = useSteps(workspaceId);
  const { data: workflows = [] } = useWorkflows(workspaceId);
  const { data: workspaces = [] } = useWorkspaceList();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const workspaceTaskSource = workspace?.taskSource ?? 'local';

  const task = tasks.find((t) => t.id === taskId);
  const updateTask = useUpdateTask();
  const decompose = useDecomposeTask();
  const refreshJira = useRefreshJiraTaskStatus();
  const aiDecompose = useRequestAiDecompose();
  const importDecomp = useImportDecomposition();
  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);
  const setTerminalPanelOpen = useWorkspaceStore((s) => s.setTerminalPanelOpen);

  const [reqOpen, setReqOpen] = useState(false);
  const [viewMode, setViewMode] = useTaskBoardViewMode();

  if (!task) return <div className="p-4 text-sm text-ink-500">Task를 찾을 수 없습니다.</div>;

  const workflow = workflows.find((w) => w.id === task.workflowId);
  const taskItems = task.taskItemIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is TaskItem => Boolean(i));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-ink-850 p-3">
        <input
          value={task.title}
          onChange={(e) =>
            void updateTask.mutateAsync({
              workspaceId,
              id: task.id,
              patch: { title: e.target.value },
            })
          }
          className="w-full bg-transparent text-lg font-semibold outline-none"
        />
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
          <span className="rounded bg-ink-850 px-1.5 py-0.5">
            {workflow?.name ?? '워크플로 없음'}
          </span>
          <StatusBadge status={task.status} />
          <span>{taskItems.length}개의 TaskItem</span>
          <div className="ml-auto flex items-center gap-1">
            {workspaceTaskSource === 'jira' && task.jiraParentKey ? (
              <button
                type="button"
                onClick={() =>
                  void refreshJira.mutateAsync({ workspaceId, taskId: task.id })
                }
                disabled={refreshJira.isPending}
                title="지라에서 자식 티켓 상태를 다시 가져옵니다"
                className="rounded border border-ink-700 px-2 py-0.5 text-[11px] text-ink-300 hover:bg-ink-850 disabled:opacity-50"
              >
                {refreshJira.isPending ? '동기화 중…' : '🔄 지라 동기화'}
              </button>
            ) : null}
            <div
              className="inline-flex overflow-hidden rounded border border-ink-700 text-[11px]"
              role="tablist"
              aria-label="뷰 전환"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'kanban'}
                onClick={() => setViewMode('kanban')}
                className={`px-2 py-0.5 ${
                  viewMode === 'kanban'
                    ? 'bg-claude-500/20 text-claude-200'
                    : 'text-ink-400 hover:bg-ink-850'
                }`}
                title="칸반 뷰"
              >
                ▦ 칸반
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'flow'}
                onClick={() => setViewMode('flow')}
                className={`border-l border-ink-700 px-2 py-0.5 ${
                  viewMode === 'flow'
                    ? 'bg-claude-500/20 text-claude-200'
                    : 'text-ink-400 hover:bg-ink-850'
                }`}
                title="플로우 뷰"
              >
                ⇢ 플로우
              </button>
            </div>
            <button
              type="button"
              onClick={() => setReqOpen((x) => !x)}
              className="rounded px-2 py-0.5 text-[11px] text-ink-300 hover:bg-ink-850"
            >
              {reqOpen ? '요구사항 접기 ▴' : '요구사항 펼치기 ▾'}
            </button>
          </div>
        </div>
        {reqOpen && (
          <textarea
            value={task.requirement}
            onChange={(e) =>
              void updateTask.mutateAsync({
                workspaceId,
                id: task.id,
                patch: { requirement: e.target.value },
              })
            }
            placeholder="요구사항·Swagger·Figma·시나리오 등을 적어주세요. 분해 시 각 TaskItem 에 컨텍스트로 주입됩니다."
            className="mt-2 w-full resize-y rounded border border-ink-850 bg-ink-950 px-2 py-1 text-sm font-mono text-ink-300 outline-none focus:border-claude-500"
            rows={6}
          />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!workflow || workflow.stepIds.length === 0 || decompose.isPending}
            onClick={async () => {
              if (
                taskItems.length > 0 &&
                !window.confirm(
                  '이미 분해된 TaskItem이 있습니다. 다시 분해하면 기존 TaskItem이 삭제됩니다. 계속할까요?',
                )
              ) {
                return;
              }
              try {
                const result = await decompose.mutateAsync({ workspaceId, taskId: task.id });
                toast.success(
                  '분해 완료',
                  `${result.length}개의 TaskItem이 생성되었습니다.`,
                );
              } catch {
                /* */
              }
            }}
            className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-850 disabled:cursor-not-allowed disabled:opacity-40"
            title="워크플로의 각 Step마다 TaskItem 1개를 결정적으로 생성합니다."
          >
            {decompose.isPending ? '분해 중…' : '⚡ 빠른 분해'}
          </button>
          <button
            type="button"
            disabled={!workflow || workflow.stepIds.length === 0 || aiDecompose.isPending}
            onClick={async () => {
              if (!task.requirement.trim()) {
                if (
                  !window.confirm(
                    '요구사항이 비어 있습니다. 그래도 AI 분해를 요청할까요? (분해 품질이 떨어집니다)',
                  )
                ) {
                  return;
                }
              }
              try {
                setTerminalPanelOpen(workspaceId, true);
                const res = await aiDecompose.mutateAsync({ workspaceId, taskId: task.id });
                setActiveTerminal(workspaceId, res.sessionId);
                toast.info(
                  '🧠 AI 분해 시작됨',
                  '터미널에서 Claude가 분해를 마치면 “결과 가져오기” 를 누르세요.',
                );
              } catch {
                /* */
              }
            }}
            className="rounded border border-sky-500/60 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {aiDecompose.isPending ? '요청 중…' : '🧠 AI 분해'}
          </button>
          <button
            type="button"
            disabled={importDecomp.isPending}
            onClick={async () => {
              try {
                const result = await importDecomp.mutateAsync({ workspaceId, taskId: task.id });
                toast.success(
                  '분해 결과 가져옴',
                  `${result.length}개의 TaskItem이 생성되었습니다.`,
                );
              } catch {
                /* */
              }
            }}
            className="rounded border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-850 disabled:opacity-40"
          >
            {importDecomp.isPending ? '불러오는 중…' : '📥 분해 결과 가져오기'}
          </button>
          {workflow && workflow.stepIds.length === 0 && (
            <span className="text-xs text-amber-300">
              ⚠ 선택된 워크플로에 Step이 없습니다.
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-3">
        {taskItems.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md rounded border border-dashed border-ink-700 p-6 text-center text-sm text-ink-500">
              아직 분해되지 않았습니다. 위 ‘분해’ 버튼으로 실행 단위를 만들어 주세요.
            </div>
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanBoard
            workspaceId={workspaceId}
            items={taskItems}
            steps={steps}
          />
        ) : (
          <FlowBoard
            workspaceId={workspaceId}
            items={taskItems}
            steps={steps}
            stepIds={workflow?.stepIds ?? []}
          />
        )}
      </div>
    </div>
  );
}

function KanbanBoard({
  workspaceId,
  items,
  steps,
}: {
  workspaceId: string;
  items: TaskItem[];
  steps: Step[];
}) {
  const grouped = useMemo(() => {
    const map = new Map<ItemStatus, TaskItem[]>();
    for (const col of KANBAN_COLUMNS) map.set(col.status, []);
    for (const it of items) {
      const arr = map.get(it.status);
      if (arr) arr.push(it);
      else map.set(it.status, [it]);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.createdAt - b.createdAt);
    }
    return map;
  }, [items]);

  return (
    <div className="flex h-full min-h-0 gap-2 overflow-x-auto">
      {KANBAN_COLUMNS.map((col) => {
        const colItems = grouped.get(col.status) ?? [];
        return (
          <div
            key={col.status}
            className={`flex h-full min-h-0 w-72 shrink-0 flex-col rounded border ${col.tone}`}
          >
            <div className="flex items-center justify-between border-b border-ink-850/60 px-3 py-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-ink-300">
                {col.label}
              </span>
              <span className="rounded bg-ink-850 px-1.5 py-0.5 text-[10px] text-ink-400">
                {colItems.length}
              </span>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto p-2">
              {colItems.map((item) => (
                <KanbanCard
                  key={item.id}
                  workspaceId={workspaceId}
                  item={item}
                  step={steps.find((s) => s.id === item.stepId) ?? null}
                />
              ))}
              {colItems.length === 0 && (
                <li className="rounded border border-dashed border-ink-850 px-2 py-3 text-center text-[11px] text-ink-600">
                  비어 있음
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  workspaceId,
  item,
  step,
}: {
  workspaceId: string;
  item: TaskItem;
  step: Step | null;
}) {
  const del = useDeleteTaskItem();
  const execute = useExecuteTaskItem();
  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);
  const setTerminalPanelOpen = useWorkspaceStore((s) => s.setTerminalPanelOpen);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleRun = async () => {
    try {
      setTerminalPanelOpen(workspaceId, true);
      const { sessionId } = await execute.mutateAsync({ workspaceId, taskItemId: item.id });
      setActiveTerminal(workspaceId, sessionId);
      toast.info(`▶ "${item.name}" 실행됨`, '새 터미널 세션에서 Claude CLI 가 작업을 수행합니다.');
    } catch {
      /* */
    }
  };

  return (
    <>
      <li className="rounded border border-ink-850 bg-ink-900/70">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex w-full flex-col gap-1 p-2 text-left hover:bg-ink-850/40"
        >
          <div className="flex items-start gap-1.5">
            <span className="truncate text-sm font-medium text-white">{item.name}</span>
            {item.jiraIssueKey && (
              <a
                href={`#jira-${item.jiraIssueKey}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(`https://jira.atlassian.com/browse/${item.jiraIssueKey}`, '_blank');
                }}
                className="flex-shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-500/30"
                title={`Jira: ${item.jiraIssueKey}`}
              >
                {item.jiraIssueKey}
              </a>
            )}
            {item.syncError && (
              <span
                className="flex-shrink-0 cursor-help text-amber-400"
                title={`Jira sync 실패: ${item.syncError}`}
              >
                ⚠
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-ink-500">
            <span className="rounded bg-ink-850 px-1.5 py-0.5">{item.agentName}</span>
            {step && <span className="text-ink-600">{step.name}</span>}
            {item.sessionId && (
              <span className="text-blue-300">▶ {item.sessionId.slice(0, 6)}…</span>
            )}
          </div>
        </button>
        <div className="flex items-center justify-end gap-1 border-t border-ink-850/50 px-2 py-1">
          {item.status !== 'completed' && (
            <button
              type="button"
              disabled={execute.isPending}
              onClick={() => void handleRun()}
              className="rounded bg-claude-500/90 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-claude-400 disabled:opacity-50"
              title="새 터미널 세션에서 Claude CLI 로 실행"
            >
              ▶ 실행
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`TaskItem '${item.name}'을 삭제할까요?`)) {
                void del.mutateAsync({ workspaceId, id: item.id });
              }
            }}
            className="rounded px-1 py-0.5 text-ink-400 hover:bg-ink-850 hover:text-white"
            aria-label="Delete task item"
            title="삭제"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      </li>
      {detailOpen && (
        <TaskItemDetailModal
          workspaceId={workspaceId}
          item={item}
          step={step}
          onClose={() => setDetailOpen(false)}
          onRun={() => void handleRun()}
          running={execute.isPending}
        />
      )}
    </>
  );
}

function TaskItemDetailModal({
  workspaceId,
  item,
  step,
  onClose,
  onRun,
  running,
}: {
  workspaceId: string;
  item: TaskItem;
  step: Step | null;
  onClose: () => void;
  onRun: () => void;
  running: boolean;
}) {
  const update = useUpdateTaskItem();

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
          <div className="min-w-0 flex-1">
            <input
              autoFocus
              value={item.name}
              onChange={(e) =>
                void update.mutateAsync({
                  workspaceId,
                  id: item.id,
                  patch: { name: e.target.value },
                })
              }
              className="w-full bg-transparent text-base font-semibold text-white outline-none"
            />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
              <StatusBadge status={item.status} />
              {step && <span className="rounded bg-ink-850 px-1.5 py-0.5">{step.name}</span>}
              {item.sessionId && (
                <span className="text-blue-300">▶ {item.sessionId.slice(0, 8)}…</span>
              )}
            </div>
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              프롬프트
            </label>
            <textarea
              value={item.prompt}
              onChange={(e) =>
                void update.mutateAsync({
                  workspaceId,
                  id: item.id,
                  patch: { prompt: e.target.value },
                })
              }
              rows={14}
              className="w-full resize-y rounded border border-ink-700 bg-ink-950 px-3 py-2 font-mono text-xs text-ink-200 outline-none focus:border-claude-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                상태
              </label>
              <select
                value={item.status}
                onChange={(e) =>
                  void update.mutateAsync({
                    workspaceId,
                    id: item.id,
                    patch: { status: e.target.value as ItemStatus },
                  })
                }
                className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-claude-500"
              >
                {(['pending', 'running', 'completed', 'failed', 'skipped'] as const).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
                Agent
              </label>
              <input
                value={item.agentName}
                onChange={(e) =>
                  void update.mutateAsync({
                    workspaceId,
                    id: item.id,
                    patch: { agentName: e.target.value },
                  })
                }
                className="w-full rounded border border-ink-700 bg-ink-950 px-3 py-2 text-sm outline-none focus:border-claude-500"
                placeholder="agentName"
              />
            </div>
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
          {item.status !== 'completed' && (
            <button
              type="button"
              disabled={running}
              onClick={onRun}
              className="rounded bg-claude-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-claude-400 disabled:opacity-50"
            >
              ▶ 실행
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

const STATUS_CHIP: Record<ItemStatus, { icon: string; cls: string; label: string }> = {
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

function FlowBoard({
  workspaceId,
  items,
  steps,
  stepIds,
}: {
  workspaceId: string;
  items: TaskItem[];
  steps: Step[];
  stepIds: string[];
}) {
  const groups = useMemo(() => {
    const byStep = new Map<string, TaskItem[]>();
    for (const it of items) {
      const arr = byStep.get(it.stepId) ?? [];
      arr.push(it);
      byStep.set(it.stepId, arr);
    }
    for (const arr of byStep.values()) arr.sort((a, b) => a.createdAt - b.createdAt);

    const ordered = stepIds.length
      ? stepIds.map((id) => ({ step: steps.find((s) => s.id === id) ?? null, id }))
      : Array.from(byStep.keys()).map((id) => ({
          step: steps.find((s) => s.id === id) ?? null,
          id,
        }));

    return ordered.map(({ step, id }) => ({
      stepId: id,
      step,
      items: byStep.get(id) ?? [],
    }));
  }, [items, steps, stepIds]);

  return (
    <div className="flex h-full min-h-0 items-stretch overflow-x-auto pb-2">
      {groups.map((g, idx) => {
        const total = g.items.length;
        const done = g.items.filter((i) => i.status === 'completed').length;
        const running = g.items.some((i) => i.status === 'running');
        const failed = g.items.some((i) => i.status === 'failed');
        const tone = failed
          ? 'border-red-500/40 bg-red-500/[0.04]'
          : running
            ? 'border-blue-500/40 bg-blue-500/[0.04]'
            : total > 0 && done === total
              ? 'border-claude-500/40 bg-claude-500/[0.04]'
              : 'border-ink-700 bg-ink-900/40';
        return (
          <div key={g.stepId} className="flex items-stretch">
            <div className={`flex h-full w-72 shrink-0 flex-col rounded-lg border ${tone}`}>
              <div className="flex items-center justify-between gap-2 border-b border-ink-850/60 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                    Step {idx + 1}
                  </div>
                  <div className="truncate text-sm font-semibold text-ink-100">
                    {g.step?.name ?? '(알 수 없는 Step)'}
                  </div>
                </div>
                <span className="rounded bg-ink-850 px-1.5 py-0.5 text-[10px] text-ink-400">
                  {done}/{total}
                </span>
              </div>
              <ul className="flex-1 space-y-2 overflow-y-auto p-2">
                {g.items.map((item) => (
                  <FlowCard
                    key={item.id}
                    workspaceId={workspaceId}
                    item={item}
                    step={g.step}
                  />
                ))}
                {g.items.length === 0 && (
                  <li className="rounded border border-dashed border-ink-850 px-2 py-3 text-center text-[11px] text-ink-600">
                    비어 있음
                  </li>
                )}
              </ul>
            </div>
            {idx < groups.length - 1 && (
              <div
                className="flex w-8 shrink-0 items-center justify-center text-ink-600"
                aria-hidden="true"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <path d="M5 12h14" />
                  <path d="m13 6 6 6-6 6" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
      {groups.length === 0 && (
        <div className="flex h-full w-full items-center justify-center text-sm text-ink-500">
          표시할 Step 이 없습니다.
        </div>
      )}
    </div>
  );
}

function FlowCard({
  workspaceId,
  item,
  step,
}: {
  workspaceId: string;
  item: TaskItem;
  step: Step | null;
}) {
  const execute = useExecuteTaskItem();
  const del = useDeleteTaskItem();
  const setActiveTerminal = useWorkspaceStore((s) => s.setActiveTerminal);
  const setTerminalPanelOpen = useWorkspaceStore((s) => s.setTerminalPanelOpen);
  const [detailOpen, setDetailOpen] = useState(false);
  const chip = STATUS_CHIP[item.status] ?? STATUS_CHIP.pending;

  const handleRun = async () => {
    try {
      setTerminalPanelOpen(workspaceId, true);
      const { sessionId } = await execute.mutateAsync({ workspaceId, taskItemId: item.id });
      setActiveTerminal(workspaceId, sessionId);
      toast.info(`▶ "${item.name}" 실행됨`, '새 터미널 세션에서 Claude CLI 가 작업을 수행합니다.');
    } catch {
      /* */
    }
  };

  return (
    <>
      <li className="rounded border border-ink-850 bg-ink-900/70">
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="flex w-full items-start gap-2 p-2 text-left hover:bg-ink-850/40"
        >
          <span
            className={`mt-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1 text-[10px] font-bold ${chip.cls}`}
            title={chip.label}
          >
            {chip.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-1.5">
              <span className="block truncate text-sm font-medium text-white">{item.name}</span>
              {item.jiraIssueKey && (
                <a
                  href={`#jira-${item.jiraIssueKey}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(`https://jira.atlassian.com/browse/${item.jiraIssueKey}`, '_blank');
                  }}
                  className="flex-shrink-0 rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-500/30"
                  title={`Jira: ${item.jiraIssueKey}`}
                >
                  {item.jiraIssueKey}
                </a>
              )}
              {item.syncError && (
                <span
                  className="flex-shrink-0 cursor-help text-amber-400"
                  title={`Jira sync 실패: ${item.syncError}`}
                >
                  ⚠
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[10px] text-ink-500">
              {item.agentName}
              {item.sessionId ? ` · ▶ ${item.sessionId.slice(0, 6)}…` : ''}
            </span>
          </span>
        </button>
        <div className="flex items-center justify-end gap-1 border-t border-ink-850/50 px-2 py-1">
          {item.status !== 'completed' && (
            <button
              type="button"
              disabled={execute.isPending}
              onClick={() => void handleRun()}
              className="rounded bg-claude-500/90 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-claude-400 disabled:opacity-50"
              title="새 터미널 세션에서 Claude CLI 로 실행"
            >
              ▶ 실행
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`TaskItem '${item.name}'을 삭제할까요?`)) {
                void del.mutateAsync({ workspaceId, id: item.id });
              }
            }}
            className="rounded px-1 py-0.5 text-ink-400 hover:bg-ink-850 hover:text-white"
            aria-label="Delete task item"
            title="삭제"
          >
            ✕
          </button>
        </div>
      </li>
      {detailOpen && (
        <TaskItemDetailModal
          workspaceId={workspaceId}
          item={item}
          step={step}
          onClose={() => setDetailOpen(false)}
          onRun={() => void handleRun()}
          running={execute.isPending}
        />
      )}
    </>
  );
}
