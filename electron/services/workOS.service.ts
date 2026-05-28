import { promises as fs } from 'node:fs';
import { exec, execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { eventBus } from '../infra/event-bus';
import { CHANNELS } from '../contracts/channels';
import type { McpToastEvent } from '../contracts/mcp';
import type {
  CatalogResponse,
  CreateStepRequest,
  CreateTaskItemRequest,
  CreateTaskRequest,
  CreateWorkflowRequest,
  DecompositionSubmitItem,
  ExecuteTaskItemResponse,
  FileChange,
  FileChangeKind,
  GitCommitResponse,
  GitDiffResponse,
  GitFileDiffResponse,
  GitStatusResponse,
  Step,
  Task,
  TaskItem,
  TaskItemStatus,
  UpdateStepRequest,
  UpdateTaskItemRequest,
  UpdateTaskRequest,
  UpdateWorkflowRequest,
  Workflow,
} from '../contracts/workOS';
import { newId } from '../domain/ids';
import type { TaskSyncPort } from '../domain/task-sync-port';
import { ApiError } from '../infra/error';
import { WorkOSRepository } from '../repositories/workOS.repo';
import type { TerminalService } from './terminal.service';

const execP = promisify(exec);
const execFileP = promisify(execFile);

export type CwdResolver = { resolveCwd(workspaceId: string): Promise<string> };
export type ChangeNotifier = {
  notify(workspaceId: string, kinds: Array<'step' | 'workflow' | 'task' | 'task-item'>): void;
};
export type ProgressEmitter = {
  emit(workspaceId: string, taskItemId: string, message: string): void;
};

// workspace 단위 taskSource 설정을 조회하기 위한 좁은 포트.
// WorkspaceService 전체를 의존하지 않고 read 만 의존하면 충분하다.
export type WorkspaceLookup = {
  read(
    workspaceId: string,
  ): Promise<{ taskSource: 'local' | 'jira' } | null>;
};

export type TaskItemCompletionHook = (
  workspaceId: string,
  taskItemId: string,
  output?: string,
) => void;

export class WorkOSService {
  private readonly cache = new Map<string, WorkOSRepository>();
  private completionHook: TaskItemCompletionHook | null = null;
  private taskSyncPort: TaskSyncPort | null = null;

  constructor(
    private readonly cwd: CwdResolver,
    private readonly terminal: TerminalService,
    private readonly notify: ChangeNotifier,
    private readonly progress: ProgressEmitter = { emit: () => {} },
    private readonly workspaceLookup: WorkspaceLookup = {
      read: async () => ({ taskSource: 'local' }),
    },
  ) {}

  /** 워크스페이스 단위 taskSource 설정 조회. 없으면 'local' 로 폴백. */
  private async resolveTaskSource(workspaceId: string): Promise<'local' | 'jira'> {
    const ws = await this.workspaceLookup.read(workspaceId);
    return ws?.taskSource ?? 'local';
  }

  /**
   * 외부 consumer 가 TaskItem 완료를 구독할 수 있는 hook.
   * mcpComplete 가 호출되면 항상 발화된다 — 비동기 fire-and-forget 으로 처리되어야 한다.
   */
  setTaskItemCompletionHook(hook: TaskItemCompletionHook | null): void {
    this.completionHook = hook;
  }

  /**
   * 외부 작업 추적 시스템(Jira 등) 동기화 포트 주입.
   * workflow.taskSource !== 'local' 인 경우에만 사용된다.
   * 순환 의존을 피하기 위해 setter 로 주입한다.
   */
  setTaskSyncPort(port: TaskSyncPort | null): void {
    this.taskSyncPort = port;
  }

  private async repo(workspaceId: string): Promise<WorkOSRepository> {
    const root = await this.cwd.resolveCwd(workspaceId);
    let r = this.cache.get(root);
    if (!r) {
      r = new WorkOSRepository(root);
      await r.ensure();
      this.cache.set(root, r);
    }
    return r;
  }

  // -------- Steps --------
  async listSteps(workspaceId: string): Promise<Step[]> {
    return (await this.repo(workspaceId)).listSteps();
  }

  async createStep(req: CreateStepRequest): Promise<Step> {
    const now = Date.now();
    const v: Step = {
      id: newId(),
      name: req.name.trim(),
      description: req.description ?? '',
      agentNames: req.agentNames,
      tags: req.tags,
      createdAt: now,
      updatedAt: now,
    };
    await (await this.repo(req.workspaceId)).writeStep(v);
    this.notify.notify(req.workspaceId, ['step']);
    return v;
  }

  async updateStep(req: UpdateStepRequest): Promise<Step> {
    const r = await this.repo(req.workspaceId);
    const cur = await r.readStep(req.id);
    if (!cur) throw new ApiError('NOT_FOUND', `step not found: ${req.id}`);
    const next: Step = {
      ...cur,
      ...req.patch,
      name: req.patch.name ?? cur.name,
      updatedAt: Date.now(),
    };
    await r.writeStep(next);
    this.notify.notify(req.workspaceId, ['step']);
    return next;
  }

  async deleteStep(workspaceId: string, id: string): Promise<void> {
    const r = await this.repo(workspaceId);
    // 참조 무결성: workflow.stepIds 에서 자동 제거
    const wfs = await r.listWorkflows();
    for (const wf of wfs) {
      if (wf.stepIds.includes(id)) {
        await r.writeWorkflow({
          ...wf,
          stepIds: wf.stepIds.filter((s) => s !== id),
          updatedAt: Date.now(),
        });
      }
    }
    await r.deleteStep(id);
    this.notify.notify(workspaceId, ['step', 'workflow']);
  }

  /**
   * 같은 (소문자/trim 한 name) + (소문자/trim 한 첫 agentName) 을 가진 Step 들을 묶는다.
   * 그룹 내 createdAt 이 가장 빠른 항목이 survivor 후보(가장 안정적).
   */
  async findDuplicateSteps(workspaceId: string): Promise<{
    groups: Array<{
      key: string;
      survivor: Step;
      duplicates: Step[];
      affectedWorkflowIds: string[];
    }>;
  }> {
    const r = await this.repo(workspaceId);
    const steps = await r.listSteps();
    const workflows = await r.listWorkflows();

    const buckets = new Map<string, Step[]>();
    for (const s of steps) {
      const agent = (s.agentNames[0] ?? '').trim().toLowerCase();
      const name = s.name.trim().toLowerCase();
      if (!name) continue;
      const key = `${name}|${agent}`;
      const arr = buckets.get(key);
      if (arr) arr.push(s);
      else buckets.set(key, [s]);
    }

    const groups: Array<{
      key: string;
      survivor: Step;
      duplicates: Step[];
      affectedWorkflowIds: string[];
    }> = [];
    for (const [key, items] of buckets) {
      if (items.length < 2) continue;
      items.sort((a, b) => a.createdAt - b.createdAt);
      const survivor = items[0];
      const duplicates = items.slice(1);
      const dupSet = new Set(duplicates.map((d) => d.id));
      const affected = workflows
        .filter((wf) => wf.stepIds.some((id) => dupSet.has(id)))
        .map((wf) => wf.id);
      groups.push({ key, survivor, duplicates, affectedWorkflowIds: affected });
    }
    return { groups };
  }

  async mergeDuplicateSteps(
    workspaceId: string,
    groups: Array<{ survivorId: string; duplicateIds: string[] }>,
  ): Promise<{ deletedStepIds: string[]; updatedWorkflowIds: string[] }> {
    const r = await this.repo(workspaceId);
    const steps = await r.listSteps();
    const stepById = new Map(steps.map((s) => [s.id, s] as const));

    const replaceMap = new Map<string, string>(); // duplicateId → survivorId
    for (const g of groups) {
      if (!stepById.has(g.survivorId)) {
        throw new ApiError('NOT_FOUND', `survivor step not found: ${g.survivorId}`);
      }
      for (const did of g.duplicateIds) {
        if (did === g.survivorId) continue;
        if (!stepById.has(did)) {
          throw new ApiError('NOT_FOUND', `duplicate step not found: ${did}`);
        }
        if (replaceMap.has(did)) {
          throw new ApiError('VALIDATION', `step appears in multiple groups: ${did}`);
        }
        replaceMap.set(did, g.survivorId);
      }
    }
    if (replaceMap.size === 0) return { deletedStepIds: [], updatedWorkflowIds: [] };

    // workflow.stepIds 치환 — 순서 유지, 연속 중복은 dedupe.
    const workflows = await r.listWorkflows();
    const updatedWorkflowIds: string[] = [];
    for (const wf of workflows) {
      if (!wf.stepIds.some((id) => replaceMap.has(id))) continue;
      const replaced = wf.stepIds.map((id) => replaceMap.get(id) ?? id);
      const collapsed: string[] = [];
      for (const id of replaced) {
        if (collapsed[collapsed.length - 1] !== id) collapsed.push(id);
      }
      await r.writeWorkflow({ ...wf, stepIds: collapsed, updatedAt: Date.now() });
      updatedWorkflowIds.push(wf.id);
    }

    // duplicate step 삭제
    const deletedStepIds: string[] = [];
    for (const did of replaceMap.keys()) {
      await r.deleteStep(did);
      deletedStepIds.push(did);
    }

    this.notify.notify(workspaceId, ['step', 'workflow']);
    return { deletedStepIds, updatedWorkflowIds };
  }

  // -------- Workflows --------
  async listWorkflows(workspaceId: string): Promise<Workflow[]> {
    return (await this.repo(workspaceId)).listWorkflows();
  }

  async createWorkflow(req: CreateWorkflowRequest): Promise<Workflow> {
    const now = Date.now();
    const v: Workflow = {
      id: newId(),
      name: req.name.trim(),
      description: req.description ?? '',
      stepIds: req.stepIds ?? [],
      tags: req.tags,
      createdAt: now,
      updatedAt: now,
    };
    await (await this.repo(req.workspaceId)).writeWorkflow(v);
    this.notify.notify(req.workspaceId, ['workflow']);
    return v;
  }

  async updateWorkflow(req: UpdateWorkflowRequest): Promise<Workflow> {
    const r = await this.repo(req.workspaceId);
    const cur = await r.readWorkflow(req.id);
    if (!cur) throw new ApiError('NOT_FOUND', `workflow not found: ${req.id}`);
    const next: Workflow = {
      ...cur,
      ...req.patch,
      name: req.patch.name ?? cur.name,
      updatedAt: Date.now(),
    };
    await r.writeWorkflow(next);
    this.notify.notify(req.workspaceId, ['workflow']);
    return next;
  }

  async deleteWorkflow(workspaceId: string, id: string): Promise<void> {
    const r = await this.repo(workspaceId);
    const tasks = await r.listTasks();
    if (tasks.some((t) => t.workflowId === id)) {
      throw new ApiError(
        'VALIDATION',
        '이 워크플로를 참조하는 Task가 있어 삭제할 수 없습니다. 먼저 Task를 정리하세요.',
      );
    }
    await r.deleteWorkflow(id);
    this.notify.notify(workspaceId, ['workflow']);
  }

  // -------- Tasks --------
  async listTasks(workspaceId: string): Promise<Task[]> {
    return (await this.repo(workspaceId)).listTasks();
  }

  async createTask(req: CreateTaskRequest): Promise<Task> {
    const r = await this.repo(req.workspaceId);
    const wf = await r.readWorkflow(req.workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${req.workflowId}`);

    const taskSource = await this.resolveTaskSource(req.workspaceId);

    let jiraParentKey: string | undefined;
    let jiraParentType: string | undefined;
    if (taskSource === 'jira') {
      if (!req.jiraParentKey) {
        throw new ApiError(
          'VALIDATION',
          '지라 기반 워크플로우는 jiraParentKey가 필요합니다.',
        );
      }
      if (!this.taskSyncPort) {
        throw new ApiError('INTERNAL', 'Task sync port is not wired.');
      }
      const detail = await this.taskSyncPort.getParent(req.jiraParentKey);
      jiraParentKey = detail.key;
      jiraParentType = detail.issueType;
    }

    const now = Date.now();
    const isJira = taskSource === 'jira';
    const v: Task = {
      id: newId(),
      workflowId: req.workflowId,
      requirement: req.requirement ?? '',
      title: req.title.trim(),
      status: 'pending',
      taskItemIds: [],
      jiraParentKey,
      jiraParentType,
      jiraChildMode: isJira ? req.jiraChildMode : undefined,
      jiraExplicitChildKeys: isJira ? req.jiraExplicitChildKeys : undefined,
      createdAt: now,
      updatedAt: now,
    };
    await r.writeTask(v);
    this.notify.notify(req.workspaceId, ['task']);
    return v;
  }

  /**
   * 워크플로 실행 중 새로 만들어진 Jira 자식 티켓을 Task 에 attach.
   * jiraExplicitChildKeys 끝에 append (중복 제거). mode 가 'all' 이면 다음 sync 시
   * 무시되지만 attach 자체는 항상 누적해 둔다.
   */
  async attachJiraChildKey(
    workspaceId: string,
    taskId: string,
    jiraKey: string,
  ): Promise<void> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${taskId}`);
    const existing = task.jiraExplicitChildKeys ?? [];
    if (existing.includes(jiraKey)) return;
    const next: Task = {
      ...task,
      jiraExplicitChildKeys: [...existing, jiraKey],
      updatedAt: Date.now(),
    };
    await r.writeTask(next);
    this.notify.notify(workspaceId, ['task']);
  }

  /** Repo passthrough — control plane uses this to look up parent Task. */
  async readTask(workspaceId: string, taskId: string): Promise<Task | null> {
    return (await this.repo(workspaceId)).readTask(taskId);
  }

  /** 가장 최근에 시작된 running TaskItem 반환. control plane 자동 attach 추론용. */
  async findRunningTaskItem(workspaceId: string): Promise<TaskItem | null> {
    const items = await (await this.repo(workspaceId)).listTaskItems();
    const running = items.filter((i) => i.status === 'running');
    if (running.length === 0) return null;
    running.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    return running[0] ?? null;
  }

  /** Jira 모드 Task 의 자식 티켓 status 를 외부에서 가져와 TaskItem 에 역방향 반영. */
  async refreshJiraTaskStatus(
    workspaceId: string,
    taskId: string,
  ): Promise<{ updatedItems: number }> {
    if (!this.taskSyncPort) return { updatedItems: 0 };
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${taskId}`);
    if (!task.jiraParentKey) return { updatedItems: 0 };
    const wf = await r.readWorkflow(task.workflowId);
    if (!wf) return { updatedItems: 0 };
    const taskSource = await this.resolveTaskSource(workspaceId);
    if (taskSource !== 'jira') return { updatedItems: 0 };

    const children = await this.taskSyncPort.listChildren(task.jiraParentKey);
    const items = await r.listTaskItems();
    let updated = 0;
    for (const child of children) {
      const newStatus = mapJiraStatusToTaskItem(child.status);
      if (!newStatus) continue;
      const cur = items.find(
        (i) => i.taskId === task.id && i.jiraIssueKey === child.key,
      );
      if (!cur) continue;
      if (cur.status === newStatus) continue;
      await r.writeTaskItem({ ...cur, status: newStatus, updatedAt: Date.now() });
      updated += 1;
    }
    if (updated > 0) this.notify.notify(workspaceId, ['task-item']);
    return { updatedItems: updated };
  }

  async updateTask(req: UpdateTaskRequest): Promise<Task> {
    const r = await this.repo(req.workspaceId);
    const cur = await r.readTask(req.id);
    if (!cur) throw new ApiError('NOT_FOUND', `task not found: ${req.id}`);
    const next: Task = { ...cur, ...req.patch, updatedAt: Date.now() };
    await r.writeTask(next);
    this.notify.notify(req.workspaceId, ['task']);
    return next;
  }

  async deleteTask(workspaceId: string, id: string): Promise<void> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(id);
    if (task) {
      for (const itemId of task.taskItemIds) await r.deleteTaskItem(itemId);
    }
    await r.deleteTask(id);
    this.notify.notify(workspaceId, ['task', 'task-item']);
  }

  /**
   * Router — 워크스페이스 단위 taskSource 에 따라 로컬/외부 분해를 위임. 외부 시그니처 유지.
   */
  async decomposeTask(workspaceId: string, taskId: string): Promise<TaskItem[]> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${taskId}`);
    const wf = await r.readWorkflow(task.workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${task.workflowId}`);
    const taskSource = await this.resolveTaskSource(workspaceId);
    return taskSource === 'jira'
      ? this.syncFromJiraParent(workspaceId, taskId)
      : this.decomposeFromWorkflow(workspaceId, taskId);
  }

  /**
   * 공통 후처리 — TaskItem 목록을 Task 에 반영하고 알림.
   */
  private async finalizeDecomposition(
    workspaceId: string,
    task: Task,
    created: TaskItem[],
  ): Promise<TaskItem[]> {
    const r = await this.repo(workspaceId);
    const next: Task = {
      ...task,
      taskItemIds: created.map((c) => c.id),
      status: created.length ? 'in_progress' : task.status,
      updatedAt: Date.now(),
    };
    await r.writeTask(next);
    this.notify.notify(workspaceId, ['task', 'task-item']);
    return created;
  }

  /**
   * 로컬 워크플로 기반 분해 — Step 시퀀스마다 TaskItem 1개.
   */
  async decomposeFromWorkflow(workspaceId: string, taskId: string): Promise<TaskItem[]> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${taskId}`);
    const wf = await r.readWorkflow(task.workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${task.workflowId}`);

    for (const id of task.taskItemIds) await r.deleteTaskItem(id);

    const created: TaskItem[] = [];
    const now = Date.now();
    for (const stepId of wf.stepIds) {
      const step = await r.readStep(stepId);
      if (!step) continue; // dangling step ref — skip
      const agentName = step.agentNames[0] ?? 'general';
      const item: TaskItem = {
        id: newId(),
        taskId: task.id,
        stepId: step.id,
        workflowId: wf.id,
        name: step.name,
        description: step.description,
        agentName,
        prompt: buildSeedPrompt(step, task, agentName),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      await r.writeTaskItem(item);
      created.push(item);
    }
    return this.finalizeDecomposition(workspaceId, task, created);
  }

  /**
   * Jira 부모 티켓 기반 분해 — 자식 티켓을 jiraChildMode 에 따라 필터링해 TaskItem 으로 변환.
   *   mode 미지정/'all' → 모든 자식
   *   'explicit'        → jiraExplicitChildKeys 에 명시된 키만
   *   'future-only'     → 아무것도 가져오지 않음 (이후 attach 로 채워짐)
   */
  async syncFromJiraParent(workspaceId: string, taskId: string): Promise<TaskItem[]> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${taskId}`);
    const wf = await r.readWorkflow(task.workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${task.workflowId}`);

    if (!task.jiraParentKey) {
      throw new ApiError('VALIDATION', '지라 부모 티켓이 지정되지 않았습니다.');
    }
    if (!this.taskSyncPort) {
      throw new ApiError('INTERNAL', 'Task sync port is not wired.');
    }
    const firstStepId = wf.stepIds[0];
    if (!firstStepId) {
      throw new ApiError('VALIDATION', '워크플로우에 step이 없습니다.');
    }
    const firstStep = await r.readStep(firstStepId);
    const agentName = firstStep?.agentNames[0] ?? 'general';

    for (const id of task.taskItemIds) await r.deleteTaskItem(id);

    const mode = task.jiraChildMode ?? 'all';
    let filtered: Array<{ key: string; summary: string; issueType: string; status: string }> = [];
    if (mode === 'future-only') {
      filtered = [];
    } else {
      const children = await this.taskSyncPort.listChildren(task.jiraParentKey);
      if (mode === 'explicit') {
        const allow = task.jiraExplicitChildKeys ?? [];
        const childKeySet = new Set(children.map((c) => c.key));
        const missing = allow.filter((k) => !childKeySet.has(k));
        if (missing.length > 0) {
          console.warn(
            `[workOS.service] jiraExplicitChildKeys 에 명시되었으나 실제 children 에 없는 키 (무시): ${missing.join(', ')}`,
          );
        }
        const allowSet = new Set(allow);
        filtered = children.filter((c) => allowSet.has(c.key));
      } else {
        filtered = children;
      }
    }

    const now = Date.now();
    const created: TaskItem[] = [];
    for (const child of filtered) {
      const item: TaskItem = {
        id: newId(),
        taskId: task.id,
        stepId: firstStepId,
        workflowId: wf.id,
        name: `[${child.key}] ${child.summary}`,
        description: `Jira ${child.issueType} · status=${child.status}`,
        agentName,
        prompt: '',
        status: 'pending',
        jiraIssueKey: child.key,
        createdAt: now,
        updatedAt: now,
      };
      await r.writeTaskItem(item);
      created.push(item);
    }
    return this.finalizeDecomposition(workspaceId, task, created);
  }

  // -------- TaskItems --------
  async listTaskItems(workspaceId: string): Promise<TaskItem[]> {
    return (await this.repo(workspaceId)).listTaskItems();
  }

  async createTaskItem(req: CreateTaskItemRequest): Promise<TaskItem> {
    const r = await this.repo(req.workspaceId);
    const task = await r.readTask(req.taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${req.taskId}`);
    const step = await r.readStep(req.stepId);
    if (!step) throw new ApiError('NOT_FOUND', `step not found: ${req.stepId}`);
    const now = Date.now();
    const item: TaskItem = {
      id: newId(),
      taskId: task.id,
      stepId: step.id,
      workflowId: task.workflowId,
      name: req.name.trim(),
      description: req.description ?? '',
      agentName: req.agentName,
      prompt: req.prompt ?? '',
      status: 'pending',
      jiraIssueKey: req.jiraIssueKey,
      createdAt: now,
      updatedAt: now,
    };
    await r.writeTaskItem(item);
    await r.writeTask({
      ...task,
      taskItemIds: [...task.taskItemIds, item.id],
      updatedAt: Date.now(),
    });
    this.notify.notify(req.workspaceId, ['task', 'task-item']);
    return item;
  }

  async updateTaskItem(req: UpdateTaskItemRequest): Promise<TaskItem> {
    const r = await this.repo(req.workspaceId);
    const cur = await r.readTaskItem(req.id);
    if (!cur) throw new ApiError('NOT_FOUND', `task item not found: ${req.id}`);
    const statusChanged =
      req.patch.status !== undefined && req.patch.status !== cur.status;
    // syncError 는 null 로 명시적 클리어를 허용 — TaskItem 타입은 undefined 만 받으므로 normalize.
    const { syncError: patchSyncError, ...restPatch } = req.patch;
    const next: TaskItem = {
      ...cur,
      ...restPatch,
      ...(patchSyncError !== undefined
        ? { syncError: patchSyncError ?? undefined }
        : {}),
      updatedAt: Date.now(),
    };
    await r.writeTaskItem(next);
    this.notify.notify(req.workspaceId, ['task-item']);

    // Auto-transition the linked external issue when TaskItem status changes.
    // Non-fatal: failures are logged, syncError is written, and a toast is broadcast.
    if (statusChanged && next.jiraIssueKey && this.taskSyncPort) {
      try {
        await this.taskSyncPort.transitionItem(next.jiraIssueKey, next.status);
        // 성공 시 syncError 클리어.
        if (next.syncError !== undefined) {
          const cleared: TaskItem = { ...next, syncError: undefined, updatedAt: Date.now() };
          await r.writeTaskItem(cleared);
          this.notify.notify(req.workspaceId, ['task-item']);
          return cleared;
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error('[workOS.service] task sync transition failed (non-fatal):', err);
        // toast 브로드캐스트
        const toast: McpToastEvent = {
          workspaceId: req.workspaceId,
          level: 'warn',
          message: `지라 transition 실패: ${next.jiraIssueKey} — ${reason}`,
        };
        eventBus.broadcast(CHANNELS.mcpEvents.toast, toast);
        // syncError 기록
        const withError: TaskItem = { ...next, syncError: reason, updatedAt: Date.now() };
        await r.writeTaskItem(withError);
        this.notify.notify(req.workspaceId, ['task-item']);
        return withError;
      }
    }
    return next;
  }

  async deleteTaskItem(workspaceId: string, id: string): Promise<void> {
    const r = await this.repo(workspaceId);
    const cur = await r.readTaskItem(id);
    if (cur) {
      const task = await r.readTask(cur.taskId);
      if (task) {
        await r.writeTask({
          ...task,
          taskItemIds: task.taskItemIds.filter((x) => x !== id),
          updatedAt: Date.now(),
        });
      }
    }
    await r.deleteTaskItem(id);
    this.notify.notify(workspaceId, ['task', 'task-item']);
  }

  async executeTaskItem(
    workspaceId: string,
    taskItemId: string,
    cols: number,
    rows: number,
  ): Promise<ExecuteTaskItemResponse> {
    const r = await this.repo(workspaceId);
    const item = await r.readTaskItem(taskItemId);
    if (!item) throw new ApiError('NOT_FOUND', `task item not found: ${taskItemId}`);

    const wrapped = `${mcpInstructions({ taskItemId: item.id })}\n${item.prompt}`;
    const promptFilePath = await r.writePromptFile(item.id, wrapped);

    // 새 터미널 세션 = 컨텍스트 격리. dispose 는 안 함 — 사용자가 결과 확인 후 직접 닫는다.
    const sessionId = await this.terminal.create(workspaceId, { cols, rows });
    // 세션 이름을 알아보기 쉽게 — TaskItem 이름으로 변경
    try {
      this.terminal.rename(sessionId, `▶ ${item.name}`.slice(0, 60));
    } catch {
      // ignore — best effort
    }

    // claude CLI 가 없을 수도 있으므로 fallback 메시지 함께 출력.
    // 명령은 1줄로 — 파일 경로만 따옴표로 감싸 안전 전달.
    const safePath = promptFilePath.replace(/"/g, '\\"');
    const line = `claude --dangerously-skip-permissions "Read the file at ${safePath} and execute the instructions inside as if they were my next request."`;
    // 약간의 지연으로 셸 prompt 가 뜨도록 한다.
    setTimeout(() => {
      try {
        this.terminal.write(sessionId, `${line}\n`);
      } catch {
        // ignore
      }
    }, 250);

    const updated: TaskItem = {
      ...item,
      status: 'running',
      sessionId,
      promptFilePath,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await r.writeTaskItem(updated);
    this.notify.notify(workspaceId, ['task-item']);

    return { sessionId, promptFilePath };
  }

  // -------- MCP-driven status push (called from control plane) -------------

  async mcpGetTaskItem(workspaceId: string, taskItemId: string): Promise<TaskItem> {
    const r = await this.repo(workspaceId);
    const item = await r.readTaskItem(taskItemId);
    if (!item) throw new ApiError('NOT_FOUND', `task item not found: ${taskItemId}`);
    return item;
  }

  async mcpProgress(workspaceId: string, taskItemId: string, message: string): Promise<void> {
    const r = await this.repo(workspaceId);
    const item = await r.readTaskItem(taskItemId);
    if (!item) throw new ApiError('NOT_FOUND', `task item not found: ${taskItemId}`);
    if (item.status !== 'running') {
      // Auto-promote to running so a missed start does not block the flow.
      await r.writeTaskItem({
        ...item,
        status: 'running',
        startedAt: item.startedAt ?? Date.now(),
        updatedAt: Date.now(),
      });
      this.notify.notify(workspaceId, ['task-item']);
    }
    this.progress.emit(workspaceId, taskItemId, message);
  }

  async mcpComplete(
    workspaceId: string,
    taskItemId: string,
    output?: string,
    artifactPath?: string,
  ): Promise<TaskItem> {
    const r = await this.repo(workspaceId);
    const item = await r.readTaskItem(taskItemId);
    if (!item) throw new ApiError('NOT_FOUND', `task item not found: ${taskItemId}`);
    const next: TaskItem = {
      ...item,
      status: 'completed',
      output: output ?? item.output,
      artifactPath: artifactPath ?? item.artifactPath,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await r.writeTaskItem(next);
    this.notify.notify(workspaceId, ['task-item']);
    await this.maybeRollupTaskStatus(workspaceId, item.taskId);
    // 외부 구독자(자비스 위저드 등) 통지 — fire-and-forget.
    if (this.completionHook) {
      try {
        this.completionHook(workspaceId, taskItemId, output);
      } catch (err) {
        // hook 실패가 mcpComplete 본 흐름을 막아선 안 된다.
        console.error('[workOS] completion hook error:', err);
      }
    }
    return next;
  }

  async mcpFail(workspaceId: string, taskItemId: string, error: string): Promise<TaskItem> {
    const r = await this.repo(workspaceId);
    const item = await r.readTaskItem(taskItemId);
    if (!item) throw new ApiError('NOT_FOUND', `task item not found: ${taskItemId}`);
    const next: TaskItem = {
      ...item,
      status: 'failed',
      error,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await r.writeTaskItem(next);
    this.notify.notify(workspaceId, ['task-item']);
    return next;
  }

  /**
   * Pick the next pending TaskItem in the same Task as `taskItemId` and execute it.
   * "다음" 정의: 같은 Task 의 TaskItem 중 status === 'pending' 이고 createdAt 이 가장 빠른 항목.
   * 다음 항목이 없으면 nextTaskItemId === null 로 반환한다 (예외 X — CLI 가 종료 신호로 사용).
   */
  async mcpRunNext(
    workspaceId: string,
    taskItemId: string,
  ): Promise<{
    nextTaskItemId: string | null;
    sessionId: string | null;
    promptFilePath: string | null;
  }> {
    const r = await this.repo(workspaceId);
    const current = await r.readTaskItem(taskItemId);
    if (!current) throw new ApiError('NOT_FOUND', `task item not found: ${taskItemId}`);
    const task = await r.readTask(current.taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${current.taskId}`);

    const candidates: TaskItem[] = [];
    for (const id of task.taskItemIds) {
      if (id === taskItemId) continue;
      const it = await r.readTaskItem(id);
      if (it && it.status === 'pending') candidates.push(it);
    }
    if (candidates.length === 0) {
      return { nextTaskItemId: null, sessionId: null, promptFilePath: null };
    }
    candidates.sort((a, b) => a.createdAt - b.createdAt);
    const next = candidates[0];

    // MCP-driven trigger → 실제 PTY 크기 없음. 화면 크기와 무관한 합리적 기본값.
    const { sessionId, promptFilePath } = await this.executeTaskItem(
      workspaceId,
      next.id,
      120,
      30,
    );
    return { nextTaskItemId: next.id, sessionId, promptFilePath };
  }

  /**
   * Append new TaskItem(s) to the same Task as `taskItemId`.
   * 진행 중인 TaskItem 의 결과로 추가 TaskItem 이 필요할 때 호출.
   * stepId 가 비어 있으면 현재 TaskItem 의 stepId 를 재사용한다.
   * 생성된 항목은 task.taskItemIds 끝에 append → 다음 run_next 호출 시 자연스럽게 선택된다.
   */
  async mcpAddTaskItems(
    workspaceId: string,
    taskItemId: string,
    items: Array<{
      stepId?: string;
      name: string;
      description?: string;
      agentName: string;
      prompt?: string;
    }>,
  ): Promise<TaskItem[]> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ApiError('VALIDATION', 'items 배열이 비어 있습니다');
    }
    const r = await this.repo(workspaceId);
    const current = await r.readTaskItem(taskItemId);
    if (!current) throw new ApiError('NOT_FOUND', `task item not found: ${taskItemId}`);
    const task = await r.readTask(current.taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${current.taskId}`);
    const wf = await r.readWorkflow(task.workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${task.workflowId}`);
    const validStepIds = new Set(wf.stepIds);

    const created: TaskItem[] = [];
    // createdAt 을 단조 증가시켜 run_next 의 "가장 빠른 createdAt" 정렬과 충돌 안 함.
    let now = Date.now();
    for (const e of items) {
      const name = (e.name ?? '').trim();
      const agentName = (e.agentName ?? '').trim();
      const stepId = e.stepId && validStepIds.has(e.stepId) ? e.stepId : current.stepId;
      if (!name || !agentName) {
        throw new ApiError('VALIDATION', 'name 과 agentName 은 필수입니다');
      }
      const item: TaskItem = {
        id: newId(),
        taskId: task.id,
        stepId,
        workflowId: wf.id,
        name,
        description: e.description ?? '',
        agentName,
        prompt: e.prompt ?? '',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      await r.writeTaskItem(item);
      created.push(item);
      now += 1;
    }
    await r.writeTask({
      ...task,
      taskItemIds: [...task.taskItemIds, ...created.map((c) => c.id)],
      status: task.status === 'completed' ? 'in_progress' : task.status,
      updatedAt: Date.now(),
    });
    this.notify.notify(workspaceId, ['task', 'task-item']);
    return created;
  }

  async mcpTaskContext(
    workspaceId: string,
    taskItemId: string,
  ): Promise<{
    task: Task;
    workflow: Workflow;
    self: TaskItem;
    siblings: Array<Pick<TaskItem, 'id' | 'name' | 'status' | 'stepId'>>;
  }> {
    const r = await this.repo(workspaceId);
    const self = await r.readTaskItem(taskItemId);
    if (!self) throw new ApiError('NOT_FOUND', `task item not found: ${taskItemId}`);
    const task = await r.readTask(self.taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${self.taskId}`);
    const workflow = await r.readWorkflow(task.workflowId);
    if (!workflow)
      throw new ApiError('NOT_FOUND', `workflow not found: ${task.workflowId}`);
    const siblings: Array<Pick<TaskItem, 'id' | 'name' | 'status' | 'stepId'>> = [];
    for (const id of task.taskItemIds) {
      if (id === taskItemId) continue;
      const it = await r.readTaskItem(id);
      if (it) siblings.push({ id: it.id, name: it.name, status: it.status, stepId: it.stepId });
    }
    return { task, workflow, self, siblings };
  }

  async mcpSubmitDecomposition(
    workspaceId: string,
    taskId: string,
    items: DecompositionSubmitItem[],
  ): Promise<TaskItem[]> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${taskId}`);
    const wf = await r.readWorkflow(task.workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${task.workflowId}`);
    const validStepIds = new Set(wf.stepIds);

    for (const id of task.taskItemIds) await r.deleteTaskItem(id);

    const now = Date.now();
    const created: TaskItem[] = [];
    for (const e of items) {
      if (!validStepIds.has(e.stepId)) continue;
      const item: TaskItem = {
        id: newId(),
        taskId: task.id,
        stepId: e.stepId,
        workflowId: wf.id,
        name: e.name,
        description: e.description ?? '',
        agentName: e.agentName,
        prompt: e.prompt ?? '',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      await r.writeTaskItem(item);
      created.push(item);
    }
    const stepOrder = new Map(wf.stepIds.map((id, i) => [id, i]));
    created.sort((a, b) => (stepOrder.get(a.stepId) ?? 0) - (stepOrder.get(b.stepId) ?? 0));
    await r.writeTask({
      ...task,
      taskItemIds: created.map((c) => c.id),
      status: created.length ? 'in_progress' : task.status,
      updatedAt: Date.now(),
    });
    this.notify.notify(workspaceId, ['task', 'task-item']);
    return created;
  }

  async mcpSubmitWorkflowDraft(
    workspaceId: string,
    draftId: string,
    name: string,
    description: string,
    steps: Array<{ name: string; description?: string; agentName: string }>,
  ): Promise<{ workflowId: string }> {
    // 이미 같은 draftId 로 submit 되어 있으면 그대로 재사용 — 중복 생성 방지.
    const prior = await this.readDraftSidecar(workspaceId, draftId);
    if (prior) {
      const r0 = await this.repo(workspaceId);
      const existing = await r0.readWorkflow(prior);
      if (existing) return { workflowId: existing.id };
    }

    const r = await this.repo(workspaceId);
    const now = Date.now();
    const stepIds: string[] = [];
    for (const s of steps) {
      const step: Step = {
        id: newId(),
        name: s.name.trim(),
        description: s.description ?? '',
        agentNames: [s.agentName.trim()],
        createdAt: now,
        updatedAt: now,
      };
      await r.writeStep(step);
      stepIds.push(step.id);
    }
    if (!stepIds.length) {
      throw new ApiError('VALIDATION', '유효한 Step이 한 개도 없습니다');
    }
    const wf: Workflow = {
      id: newId(),
      name: name.trim(),
      description,
      stepIds,
      createdAt: now,
      updatedAt: now,
    };
    await r.writeWorkflow(wf);
    await this.writeDraftSidecar(workspaceId, draftId, wf.id);
    this.notify.notify(workspaceId, ['step', 'workflow']);
    return { workflowId: wf.id };
  }

  /** draft → workflow 매핑 사이드카 경로. */
  private draftSidecarPath(root: string, draftId: string): string {
    return path.join(root, '.claude', 'workOS', 'workflow-drafts', `${draftId}.submitted.json`);
  }

  private async readDraftSidecar(
    workspaceId: string,
    draftId: string,
  ): Promise<string | null> {
    try {
      const root = await this.cwd.resolveCwd(workspaceId);
      const raw = await fs.readFile(this.draftSidecarPath(root, draftId), 'utf-8');
      const parsed = JSON.parse(raw) as { workflowId?: unknown };
      return typeof parsed.workflowId === 'string' ? parsed.workflowId : null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      return null;
    }
  }

  private async writeDraftSidecar(
    workspaceId: string,
    draftId: string,
    workflowId: string,
  ): Promise<void> {
    try {
      const root = await this.cwd.resolveCwd(workspaceId);
      const p = this.draftSidecarPath(root, draftId);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, JSON.stringify({ workflowId, at: Date.now() }, null, 2), 'utf-8');
    } catch {
      // best-effort — 사이드카 없으면 가져오기 버튼이 중복 생성할 수 있지만 fatal X
    }
  }

  /** When every TaskItem in a Task is terminal, roll the Task up to completed. */
  private async maybeRollupTaskStatus(workspaceId: string, taskId: string): Promise<void> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) return;
    if (task.taskItemIds.length === 0) return;
    let allDone = true;
    for (const id of task.taskItemIds) {
      const it = await r.readTaskItem(id);
      if (!it) continue;
      if (it.status !== 'completed' && it.status !== 'skipped') {
        allDone = false;
        break;
      }
    }
    if (allDone && task.status !== 'completed') {
      await r.writeTask({ ...task, status: 'completed', updatedAt: Date.now() });
      this.notify.notify(workspaceId, ['task']);
    }
  }

  // -------- Onboarding / Preset --------
  async seedPresetWorkflow(workspaceId: string): Promise<{ workflowId: string }> {
    const r = await this.repo(workspaceId);
    const now = Date.now();

    // concept.md §6 의 12 스텝 — 프론트엔드 신규 기능 개발 워크플로.
    const PRESET: Array<{ name: string; description: string; agent: string }> = [
      {
        name: 'API 요구사항 분석',
        description: '요구사항을 만족하기 위해 필요한 Swagger 문서 분석, 신규/수정 API 리스트 추출.',
        agent: 'oh-my-claudecode:analyst',
      },
      {
        name: 'API 레이어 개발',
        description:
          '추출된 API 개수만큼 태스크 자동 생성. API 호출 + React Query 기반 server-state 레이어 개발.',
        agent: 'api-layer',
      },
      {
        name: '비즈니스 요구사항 분석',
        description: '요구사항 → 도메인 모델·비즈니스 규칙 식별.',
        agent: 'oh-my-claudecode:analyst',
      },
      {
        name: '비즈니스 로직 개발',
        description: 'use-case, 도메인 규칙, 검증/계산 로직 구현.',
        agent: 'business-layer',
      },
      {
        name: 'UI 시안 분석',
        description: 'Figma 시안 분석, 디자인 시스템에 추가가 필요한 컴포넌트 목록 추출.',
        agent: 'oh-my-claudecode:designer',
      },
      {
        name: '디자인 시스템 컴포넌트 추가',
        description: '시안에 따라 디자인 시스템에 신규 컴포넌트 등록.',
        agent: 'oh-my-claudecode:designer',
      },
      {
        name: '페이지 컴포넌트 추가',
        description: '시안에 맞는 페이지 단위 프레젠테이션 컴포넌트 구현.',
        agent: 'presentation-layer',
      },
      {
        name: '기능 조립',
        description: '비즈니스 로직 + 프레젠테이션 컴포넌트 조합해 실제 기능 구현.',
        agent: 'oh-my-claudecode:executor',
      },
      {
        name: '테스트 코드 작성',
        description: '추가/수정된 기능에 대한 테스트 작성.',
        agent: 'oh-my-claudecode:test-engineer',
      },
      {
        name: '프로덕트 문서 업데이트',
        description: '신규/변경된 기능을 위키/프로덕트 문서에 반영.',
        agent: 'oh-my-claudecode:writer',
      },
      {
        name: '코드 리뷰',
        description: '회사 컨벤션을 학습한 코드 리뷰 전문 에이전트가 검수.',
        agent: 'oh-my-claudecode:code-reviewer',
      },
      {
        name: '커밋 & PR',
        description: '최종 커밋 및 PR 생성.',
        agent: 'oh-my-claudecode:git-master',
      },
    ];

    const stepIds: string[] = [];
    for (const p of PRESET) {
      const v: Step = {
        id: newId(),
        name: p.name,
        description: p.description,
        agentNames: [p.agent],
        createdAt: now,
        updatedAt: now,
      };
      await r.writeStep(v);
      stepIds.push(v.id);
    }
    const wf: Workflow = {
      id: newId(),
      name: '프론트엔드 신규 기능 개발 (샘플)',
      description:
        'docs/concept.md §6 의 표준 워크플로 — 자유롭게 편집/복제하여 본인 스타일로 다듬으세요.',
      stepIds,
      createdAt: now,
      updatedAt: now,
    };
    await r.writeWorkflow(wf);
    this.notify.notify(workspaceId, ['step', 'workflow']);
    return { workflowId: wf.id };
  }

  // -------- AI Decompose (Claude CLI 우회) --------
  async requestAiDecomposition(
    workspaceId: string,
    taskId: string,
    cols: number,
    rows: number,
  ): Promise<{ sessionId: string; promptFilePath: string; outputJsonPath: string }> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${taskId}`);
    const wf = await r.readWorkflow(task.workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${task.workflowId}`);
    const stepDetails: Array<{ id: string; name: string; description: string; agentName: string }> =
      [];
    for (const sid of wf.stepIds) {
      const s = await r.readStep(sid);
      if (s) {
        stepDetails.push({
          id: s.id,
          name: s.name,
          description: s.description,
          agentName: s.agentNames[0] ?? 'general',
        });
      }
    }

    const root = await this.cwd.resolveCwd(workspaceId);
    const decompDir = path.join(root, '.claude', 'workOS', 'decompositions');
    await fs.mkdir(decompDir, { recursive: true });
    const outputJsonPath = path.join(decompDir, `${taskId}.json`);
    // 클린 슬레이트 — 이전 분해 결과가 있으면 제거.
    await fs.rm(outputJsonPath, { force: true });

    const promptBody = [
      '# 자동 태스크 분해 요청',
      '',
      mcpInstructions({ taskId }),
      '당신은 워크OS의 분석 에이전트입니다. 아래 요구사항과 워크플로 정의를 읽고, ',
      '각 Step 아래 필요한 TaskItem을 N개 자동 분해하세요. (필요 없는 Step은 건너뛰어도 됩니다.)',
      '',
      '## 요구사항',
      task.requirement || '(요구사항이 비어 있습니다. Task 상세 화면에서 요구사항을 채워주세요.)',
      '',
      '## 워크플로',
      `이름: ${wf.name}`,
      `설명: ${wf.description}`,
      '',
      '### Steps (순서대로)',
      ...stepDetails.map(
        (s, i) =>
          `${i + 1}. **${s.name}** (id=${s.id}, agent=${s.agentName})\n   ${s.description}`,
      ),
      '',
      '## 출력 규약',
      `다음 경로에 JSON 배열로 저장하세요: \`${outputJsonPath}\``,
      '',
      '스키마:',
      '```json',
      '[',
      '  {',
      '    "stepId": "위 Step id 중 하나",',
      '    "name": "이 TaskItem의 짧은 이름",',
      '    "description": "한 줄 설명",',
      '    "agentName": "사용할 에이전트 (Step의 기본 agent 사용해도 OK)",',
      '    "prompt": "이 TaskItem 실행 시 Claude 에게 주어질 프롬프트 본문 (markdown 가능)"',
      '  }',
      ']',
      '```',
      '',
      '## 지시 사항',
      '- 한 Step 당 0개 이상의 TaskItem 을 만드세요. 의미 없는 Step은 비워도 됩니다.',
      '- 각 TaskItem 의 `prompt` 는 그 단위만을 위한 좁은 프롬프트여야 합니다. ',
      '  요구사항 전체를 복붙하지 말고, 그 단위에 꼭 필요한 컨텍스트만 추출하세요.',
      '- 출력은 위 JSON 파일에 쓰는 것만으로 충분합니다. 작업이 끝나면 "분해 완료 — n개" 라고 한 줄 알려주세요.',
      '',
      `완료 후 워크OS 앱에서 "분해 결과 가져오기" 버튼을 누르면 ${outputJsonPath} 를 읽어 TaskItem을 생성합니다.`,
      '',
    ].join('\n');

    const promptFilePath = await r.writePromptFile(taskId, promptBody);

    const sessionId = await this.terminal.create(workspaceId, { cols, rows });
    try {
      this.terminal.rename(sessionId, `🧠 분해: ${task.title}`.slice(0, 60));
    } catch {
      // ignore
    }
    const safePath = promptFilePath.replace(/"/g, '\\"');
    const line = `claude --dangerously-skip-permissions "Read the file at ${safePath} and execute the instructions inside as if they were my next request."`;
    setTimeout(() => {
      try {
        this.terminal.write(sessionId, `${line}\n`);
      } catch {
        // ignore
      }
    }, 250);

    return { sessionId, promptFilePath, outputJsonPath };
  }

  async importDecomposition(workspaceId: string, taskId: string): Promise<TaskItem[]> {
    const r = await this.repo(workspaceId);
    const task = await r.readTask(taskId);
    if (!task) throw new ApiError('NOT_FOUND', `task not found: ${taskId}`);
    const wf = await r.readWorkflow(task.workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${task.workflowId}`);
    const root = await this.cwd.resolveCwd(workspaceId);
    const outPath = path.join(root, '.claude', 'workOS', 'decompositions', `${taskId}.json`);

    let raw: string;
    try {
      raw = await fs.readFile(outPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ApiError(
          'NOT_FOUND',
          `분해 결과 파일을 찾을 수 없습니다: ${outPath}\nClaude CLI가 아직 작성 중일 수 있습니다.`,
        );
      }
      throw err;
    }
    let arr: unknown;
    try {
      arr = JSON.parse(raw);
    } catch (e) {
      throw new ApiError('VALIDATION', `분해 결과 JSON 파싱 실패: ${(e as Error).message}`);
    }
    if (!Array.isArray(arr)) {
      throw new ApiError('VALIDATION', '분해 결과는 JSON 배열이어야 합니다');
    }

    // 기존 TaskItem 정리
    for (const id of task.taskItemIds) await r.deleteTaskItem(id);

    const created: TaskItem[] = [];
    const validStepIds = new Set(wf.stepIds);
    const now = Date.now();
    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      const o = e as Record<string, unknown>;
      const stepId = typeof o.stepId === 'string' ? o.stepId : '';
      const name = typeof o.name === 'string' ? o.name.trim() : '';
      const prompt = typeof o.prompt === 'string' ? o.prompt : '';
      const description = typeof o.description === 'string' ? o.description : '';
      const agentName = typeof o.agentName === 'string' ? o.agentName : '';
      if (!stepId || !validStepIds.has(stepId) || !name || !agentName) continue;
      const item: TaskItem = {
        id: newId(),
        taskId: task.id,
        stepId,
        workflowId: wf.id,
        name,
        description,
        agentName,
        prompt,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      await r.writeTaskItem(item);
      created.push(item);
    }

    // 워크플로 스텝 순서대로 정렬 (안정성)
    const stepOrder = new Map(wf.stepIds.map((id, i) => [id, i]));
    created.sort((a, b) => (stepOrder.get(a.stepId) ?? 0) - (stepOrder.get(b.stepId) ?? 0));

    await r.writeTask({
      ...task,
      taskItemIds: created.map((c) => c.id),
      status: created.length ? 'in_progress' : task.status,
      updatedAt: Date.now(),
    });
    this.notify.notify(workspaceId, ['task', 'task-item']);
    return created;
  }

  // -------- AI Workflow Generation --------
  async requestAiWorkflowGeneration(
    workspaceId: string,
    requirement: string,
    cols: number,
    rows: number,
  ): Promise<{
    draftId: string;
    sessionId: string;
    promptFilePath: string;
    outputJsonPath: string;
  }> {
    const r = await this.repo(workspaceId);
    const draftId = newId();
    const root = await this.cwd.resolveCwd(workspaceId);
    const draftDir = path.join(root, '.claude', 'workOS', 'workflow-drafts');
    await fs.mkdir(draftDir, { recursive: true });
    const outputJsonPath = path.join(draftDir, `${draftId}.json`);

    // 사용 가능한 카탈로그를 프롬프트에 주입 — Claude가 실재 에이전트만 바인딩하도록.
    const cat = await this.catalog(workspaceId);
    const agentCatalog =
      cat.agents.length > 0
        ? cat.agents
            .map((a) => `- **${a.name}**${a.description ? `: ${a.description}` : ''}`)
            .join('\n')
        : '- (등록된 에이전트가 없습니다. 모든 Step 에 대해 newAgents 를 정의해야 합니다.)';

    const body = [
      '# 워크플로 자동 생성 요청',
      '',
      mcpInstructions({ draftId }),
      '당신은 워크OS의 워크플로 설계자입니다. 아래 요구사항을 읽고, ',
      '그 요구사항을 충족하기 위한 작업 워크플로(=Step 시퀀스)를 설계하세요.',
      '',
      '## 사용자 요구사항',
      requirement,
      '',
      '## 워크플로 설계 원칙 (반드시 준수)',
      '- 각 Step은 **단일 책임**을 가져야 합니다. "모든 것"을 하는 거대 Step 금지.',
      '- Step 순서는 **실행 순서**입니다 — 의존성이 있는 작업이 뒤에 오도록 정렬하세요.',
      '- 각 Step의 description은 분해 에이전트에게 줄 **책임 정의**입니다. 명확히 적으세요.',
      '- 보통 5~12개 Step이 적절합니다. 너무 잘게 쪼개거나 너무 통합하지 마세요.',
      '',
      '## 에이전트 바인딩 규칙 (매우 중요)',
      '- 각 Step.agentName 은 (a) 아래 "기존 에이전트" 목록의 이름이거나, (b) 동일 JSON 의 newAgents 에 정의한 이름이어야 합니다.',
      '- 책임이 정확히 맞는 기존 에이전트가 있으면 그것을 선택하세요. **이름만 비슷하다고 고르지 마세요** — 설명을 읽고 책임이 맞을 때만 매칭.',
      '- 알맞은 기존 에이전트가 없으면 **반드시 (1) 새 스킬 + (2) 새 에이전트 를 함께 정의**하고 그 이름을 사용하세요. (절대로 카탈로그에 없는 이름을 step.agentName 에 임의로 적지 마세요.)',
      '- 잘 모르겠으면 **터미널에서 사용자에게 직접 물어봐도 됩니다** (대화형 응답 가능). 단, 가능하면 자동 결정으로 끝내는 편이 더 좋습니다.',
      '',
      '## 새 스킬 (newSkills) — 원칙/컨벤션 캡슐화',
      '- 해당 Step 을 구현할 때 지켜야 할 **원칙·컨벤션·체크리스트** 를 .claude/skills/<name>.md 로 만듭니다.',
      '- 에이전트가 작업할 때 자동으로 컨텍스트로 로드되어 가드레일 역할을 합니다.',
      '- 새 에이전트가 필요하면 보통 그에 대응하는 새 스킬도 1개 이상 함께 정의해야 합니다.',
      '- newSkills[].body 는 마크다운 본문 — 원칙/예시/금지사항/체크리스트.',
      '- newSkills[].description 은 한 줄 트리거 — 어떤 키워드/파일에서 이 스킬이 활성화돼야 하는지 명시.',
      '',
      '## 새 에이전트 (newAgents) — 모델 메타 필수',
      '- newAgents[].prompt 는 시스템 프롬프트 — 역할/책임/입출력/금지사항/연관 스킬을 구체적으로.',
      '- newAgents[].model 은 그 에이전트가 수행하는 작업 난이도에 맞춰 선택 (필수):',
      '  - `haiku`: 간단한 라벨링/요약/추출, 짧은 응답, 비용 민감 작업.',
      '  - `sonnet`: 표준 코드 작성/수정, 디버깅, 일반 리뷰 — **대부분의 개발 작업은 여기**.',
      '  - `opus`: 아키텍처 설계, 복잡한 분석/리팩토링, 고난도 추론, 보안/성능 깊이 검토.',
      '- 잘 모르면 `sonnet` 으로. 단순/저비용이면 `haiku`, 진짜 어려운 작업이면 `opus`.',
      '- 새 에이전트 이름은 소문자/숫자/하이픈만 사용한 kebab-case 로 (예: `frontend-form-implementer`).',
      '',
      '## 출력 규약',
      `다음 경로에 JSON 으로 저장하세요: \`${outputJsonPath}\``,
      '',
      '스키마:',
      '```json',
      '{',
      '  "name": "워크플로 이름",',
      '  "description": "이 워크플로의 목적 한 문단",',
      '  "newSkills": [',
      '    {',
      '      "name": "kebab-case-skill-name",',
      '      "description": "이 스킬이 언제 활성화돼야 하는지 한 줄 트리거",',
      '      "body": "마크다운 — 원칙/체크리스트/예시/금지사항"',
      '    }',
      '  ],',
      '  "newAgents": [',
      '    {',
      '      "name": "kebab-case-agent-name",',
      '      "description": "이 에이전트가 무엇을 잘하는지 한 줄",',
      '      "model": "haiku" ,',
      '      "prompt": "시스템 프롬프트. 역할/책임/입출력/제약, 관련 newSkills 참조."',
      '    }',
      '  ],',
      '  "steps": [',
      '    {',
      '      "name": "Step 이름",',
      '      "description": "이 Step의 책임/입출력 (분해 에이전트가 읽음)",',
      '      "agentName": "기존 또는 newAgents 에 정의한 에이전트 이름"',
      '    }',
      '  ]',
      '}',
      '```',
      '',
      '## 기존 에이전트 (책임이 맞을 때만 선택)',
      agentCatalog,
      '',
      '## 지시 사항',
      '- 출력은 위 JSON 파일 작성만으로 충분합니다.',
      '- 작업이 끝나면 "워크플로 드래프트 작성 완료 — N개 Step (신규 에이전트 M개)" 이라고 한 줄 알려주세요.',
      `- 사용자가 워크OS 앱에서 "📥 드래프트 가져오기" 를 누르면 ${outputJsonPath} 를 읽어 신규 에이전트 .md 파일 → Step → Workflow 순으로 생성합니다.`,
      '',
    ].join('\n');

    // prompt 파일은 task-item 디렉토리 정책 재사용 (id 로 draftId 사용)
    const promptFilePath = await r.writePromptFile(draftId, body);

    const sessionId = await this.terminal.create(workspaceId, { cols, rows });
    try {
      this.terminal.rename(sessionId, `🧠 워크플로 생성: ${draftId.slice(0, 6)}`);
    } catch {
      // ignore
    }
    const safePath = promptFilePath.replace(/"/g, '\\"');
    const line = `claude --dangerously-skip-permissions "Read the file at ${safePath} and execute the instructions inside as if they were my next request."`;
    setTimeout(() => {
      try {
        this.terminal.write(sessionId, `${line}\n`);
      } catch {
        // ignore
      }
    }, 250);

    return { draftId, sessionId, promptFilePath, outputJsonPath };
  }

  async importWorkflowDraft(
    workspaceId: string,
    draftId: string,
  ): Promise<{ workflowId: string }> {
    const r = await this.repo(workspaceId);

    // MCP 자동 제출이 이미 워크플로를 만들었을 수 있다 — 사이드카가 있으면 그대로 재사용.
    const priorId = await this.readDraftSidecar(workspaceId, draftId);
    if (priorId) {
      const existing = await r.readWorkflow(priorId);
      if (existing) return { workflowId: existing.id };
      // 워크플로가 사용자에 의해 삭제됐다면 사이드카만 남아 있을 수 있음 — 아래로 떨어져 재생성.
    }

    const root = await this.cwd.resolveCwd(workspaceId);
    const outPath = path.join(root, '.claude', 'workOS', 'workflow-drafts', `${draftId}.json`);

    let raw: string;
    try {
      raw = await fs.readFile(outPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ApiError(
          'NOT_FOUND',
          `워크플로 드래프트 파일을 찾을 수 없습니다: ${outPath}\nClaude CLI 가 아직 작성 중일 수 있습니다.`,
        );
      }
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new ApiError('VALIDATION', `드래프트 JSON 파싱 실패: ${(e as Error).message}`);
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new ApiError('VALIDATION', '드래프트는 JSON 객체여야 합니다');
    }
    const obj = parsed as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name.trim() : '';
    const description = typeof obj.description === 'string' ? obj.description : '';
    const steps = Array.isArray(obj.steps) ? obj.steps : [];
    if (!name) throw new ApiError('VALIDATION', '워크플로 이름이 비어 있습니다');
    if (steps.length === 0)
      throw new ApiError('VALIDATION', 'steps 배열이 비어 있어 워크플로를 만들 수 없습니다');

    // 신규 스킬 → 신규 에이전트 순으로 생성 (Step 생성 전).
    // 스킬을 먼저 만들어두면 에이전트가 작업 시 즉시 컨텍스트로 로드된다.
    const skillDrafts = parseNewSkillDrafts(obj);
    if (skillDrafts.length > 0) {
      await this.ensureSkills(workspaceId, skillDrafts);
    }
    const agentDrafts = parseNewAgentDrafts(obj);
    if (agentDrafts.length > 0) {
      await this.ensureAgents(workspaceId, agentDrafts);
    }

    // 카탈로그를 다시 읽어 step.agentName 검증에 사용.
    const cat = await this.catalog(workspaceId);
    const knownAgents = new Set(cat.agents.map((a) => a.name));

    const now = Date.now();
    const stepIds: string[] = [];
    const unknownAgents: string[] = [];
    for (const s of steps) {
      if (!s || typeof s !== 'object') continue;
      const so = s as Record<string, unknown>;
      const sName = typeof so.name === 'string' ? so.name.trim() : '';
      const sDesc = typeof so.description === 'string' ? so.description : '';
      const sAgent = typeof so.agentName === 'string' ? so.agentName.trim() : '';
      if (!sName || !sAgent) continue;
      if (!knownAgents.has(sAgent)) {
        unknownAgents.push(`${sName} → ${sAgent}`);
        continue;
      }
      const step: Step = {
        id: newId(),
        name: sName,
        description: sDesc,
        agentNames: [sAgent],
        createdAt: now,
        updatedAt: now,
      };
      await r.writeStep(step);
      stepIds.push(step.id);
    }
    if (stepIds.length === 0) {
      const detail = unknownAgents.length
        ? ` — 카탈로그에 없는 에이전트가 참조됨: ${unknownAgents.join(', ')} (newAgents 정의 누락)`
        : '';
      throw new ApiError(
        'VALIDATION',
        `유효한 Step이 한 개도 없습니다 (name/agentName 누락)${detail}`,
      );
    }

    const wf: Workflow = {
      id: newId(),
      name,
      description,
      stepIds,
      createdAt: now,
      updatedAt: now,
    };
    await r.writeWorkflow(wf);
    await this.writeDraftSidecar(workspaceId, draftId, wf.id);
    this.notify.notify(workspaceId, ['step', 'workflow']);

    // 드래프트 파일은 archive 폴더로 옮겨 보관 (사용자가 git에 남기고 싶을 수 있음)
    try {
      const archived = path.join(
        root,
        '.claude',
        'workOS',
        'workflow-drafts',
        `${draftId}.imported.json`,
      );
      await fs.rename(outPath, archived);
    } catch {
      // 실패해도 무시 — 가져오기는 성공한 상태.
    }

    return { workflowId: wf.id };
  }

  // -------- AI Workflow Edit --------
  async requestAiWorkflowEdit(
    workspaceId: string,
    workflowId: string,
    instruction: string,
    cols: number,
    rows: number,
  ): Promise<{
    draftId: string;
    sessionId: string;
    promptFilePath: string;
    outputJsonPath: string;
  }> {
    const r = await this.repo(workspaceId);
    const wf = await r.readWorkflow(workflowId);
    if (!wf) throw new ApiError('NOT_FOUND', `workflow not found: ${workflowId}`);
    const currentSteps: Array<{
      id: string;
      name: string;
      description: string;
      agentName: string;
    }> = [];
    for (const sid of wf.stepIds) {
      const s = await r.readStep(sid);
      if (s) {
        currentSteps.push({
          id: s.id,
          name: s.name,
          description: s.description,
          agentName: s.agentNames[0] ?? 'general',
        });
      }
    }

    const draftId = newId();
    const root = await this.cwd.resolveCwd(workspaceId);
    const editDir = path.join(root, '.claude', 'workOS', 'workflow-edits');
    await fs.mkdir(editDir, { recursive: true });
    const outputJsonPath = path.join(editDir, `${draftId}.json`);
    // 클린 슬레이트 — 이전 실패 잔여 파일 제거.
    await fs.rm(outputJsonPath, { force: true });

    const cat = await this.catalog(workspaceId);
    const agentCatalog =
      cat.agents.length > 0
        ? cat.agents
            .map((a) => `- **${a.name}**${a.description ? `: ${a.description}` : ''}`)
            .join('\n')
        : '- (등록된 에이전트가 없습니다. 모든 Step 에 대해 newAgents 를 정의해야 합니다.)';

    const body = [
      '# 워크플로 자동 수정 요청',
      '',
      // draftId 를 전달하지 않음 — auto-submit MCP 도구는 신규 워크플로를 만들기 때문.
      // 수정 결과는 파일 기반으로만 임포트한다.
      mcpInstructions({}),
      '당신은 워크OS의 워크플로 설계자입니다. 아래 "현재 워크플로" 와 사용자의 "수정 지시" 를 읽고,',
      '수정된 워크플로 전체(=Step 시퀀스)를 다시 출력하세요.',
      '',
      '## 현재 워크플로',
      `이름: ${wf.name}`,
      `설명: ${wf.description || '(설명 없음)'}`,
      '',
      '### 현재 Steps (순서대로)',
      ...(currentSteps.length === 0
        ? ['(Step 이 비어 있습니다.)']
        : currentSteps.map(
            (s, i) =>
              `${i + 1}. **${s.name}** (agent=${s.agentName})\n   ${s.description || '(설명 없음)'}`,
          )),
      '',
      '## 사용자 수정 지시',
      instruction,
      '',
      '## 수정 원칙',
      '- 지시 내용에 따라 Step 의 추가/삭제/순서 변경/이름 변경/책임 변경 등을 자유롭게 수행하세요.',
      '- 지시에 언급되지 않은 기존 Step 은 가급적 그대로 보존하세요 (이름/설명/에이전트 동일).',
      '- 출력은 "전체 Step 시퀀스" 입니다. 변경분만 적지 말고, 수정 후 최종 Step 배열을 모두 다시 적으세요.',
      '- 보통 5~12개 Step 이 적절합니다. 너무 잘게 쪼개거나 너무 통합하지 마세요.',
      '',
      '## 에이전트 바인딩 규칙 (매우 중요)',
      '- 각 Step.agentName 은 (a) 아래 "기존 에이전트" 목록의 이름이거나, (b) 동일 JSON 의 newAgents 에 정의한 이름이어야 합니다.',
      '- 책임이 정확히 맞는 기존 에이전트가 있으면 그것을 선택하세요. **이름만 비슷하다고 고르지 마세요.**',
      '- 알맞은 기존 에이전트가 없으면 **반드시 (1) 새 스킬 + (2) 새 에이전트 를 함께 정의**하고 그 이름을 사용하세요.',
      '- 잘 모르겠으면 **터미널에서 사용자에게 직접 물어봐도 됩니다** (대화형). 가능하면 자동 결정이 더 좋습니다.',
      '- 새 에이전트 이름은 소문자/숫자/하이픈만 사용한 kebab-case 로 (예: `frontend-form-implementer`).',
      '',
      '## 새 스킬 (newSkills) — 원칙/컨벤션 캡슐화',
      '- 해당 Step 을 구현할 때 지켜야 할 **원칙·컨벤션·체크리스트** 를 .claude/skills/<name>.md 로 만듭니다.',
      '- 새 에이전트가 필요하면 보통 그에 대응하는 새 스킬도 함께 정의해야 합니다.',
      '- newSkills[].body 는 마크다운 본문, newSkills[].description 은 한 줄 트리거.',
      '',
      '## 새 에이전트 (newAgents) — 모델 메타 필수',
      '- newAgents[].model 은 작업 난이도에 맞춰 선택: `haiku`(간단한 추출/요약) / `sonnet`(표준 개발 작업) / `opus`(아키텍처·고난도 분석).',
      '- 잘 모르면 `sonnet`. 단순·저비용이면 `haiku`, 진짜 어려운 작업이면 `opus`.',
      '',
      '## 출력 규약',
      `다음 경로에 JSON 으로 저장하세요: \`${outputJsonPath}\``,
      '',
      '스키마:',
      '```json',
      '{',
      '  "name": "워크플로 이름 (수정 가능)",',
      '  "description": "워크플로 설명 (수정 가능)",',
      '  "newSkills": [',
      '    { "name": "kebab-case", "description": "트리거 한 줄", "body": "마크다운 원칙/체크리스트" }',
      '  ],',
      '  "newAgents": [',
      '    { "name": "kebab-case", "description": "한 줄", "model": "haiku", "prompt": "시스템 프롬프트" }',
      '  ],',
      '  "steps": [',
      '    { "name": "Step 이름", "description": "Step 책임/설명", "agentName": "에이전트 이름" }',
      '  ]',
      '}',
      '```',
      '',
      '## 기존 에이전트 (책임이 맞을 때만 선택)',
      agentCatalog,
      '',
      '## 지시 사항',
      '- 출력은 위 JSON 파일 작성만으로 충분합니다.',
      '- 작업이 끝나면 "워크플로 수정 드래프트 작성 완료 — N개 Step (신규 에이전트 M개)" 이라고 한 줄 알려주세요.',
      `- 사용자가 워크OS 앱에서 "📥 변경 적용" 을 누르면 ${outputJsonPath} 를 읽어 기존 워크플로를 갱신합니다.`,
      '',
    ].join('\n');

    const promptFilePath = await r.writePromptFile(draftId, body);

    const sessionId = await this.terminal.create(workspaceId, { cols, rows });
    try {
      this.terminal.rename(sessionId, `🛠 워크플로 수정: ${wf.name}`.slice(0, 60));
    } catch {
      // ignore
    }
    const safePath = promptFilePath.replace(/"/g, '\\"');
    const line = `claude --dangerously-skip-permissions "Read the file at ${safePath} and execute the instructions inside as if they were my next request."`;
    setTimeout(() => {
      try {
        this.terminal.write(sessionId, `${line}\n`);
      } catch {
        // ignore
      }
    }, 250);

    return { draftId, sessionId, promptFilePath, outputJsonPath };
  }

  async importWorkflowEdit(
    workspaceId: string,
    workflowId: string,
    draftId: string,
  ): Promise<{ workflowId: string }> {
    const r = await this.repo(workspaceId);
    const cur = await r.readWorkflow(workflowId);
    if (!cur) throw new ApiError('NOT_FOUND', `workflow not found: ${workflowId}`);
    const root = await this.cwd.resolveCwd(workspaceId);
    const outPath = path.join(root, '.claude', 'workOS', 'workflow-edits', `${draftId}.json`);

    let raw: string;
    try {
      raw = await fs.readFile(outPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ApiError(
          'NOT_FOUND',
          `워크플로 수정 드래프트 파일을 찾을 수 없습니다: ${outPath}\nClaude CLI 가 아직 작성 중일 수 있습니다.`,
        );
      }
      throw err;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new ApiError('VALIDATION', `드래프트 JSON 파싱 실패: ${(e as Error).message}`);
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new ApiError('VALIDATION', '드래프트는 JSON 객체여야 합니다');
    }
    const obj = parsed as Record<string, unknown>;
    const name =
      typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : cur.name;
    const description =
      typeof obj.description === 'string' ? obj.description : cur.description;
    const steps = Array.isArray(obj.steps) ? obj.steps : [];
    if (steps.length === 0) {
      throw new ApiError('VALIDATION', 'steps 배열이 비어 있어 워크플로를 갱신할 수 없습니다');
    }

    // 신규 스킬 → 신규 에이전트 순서로 생성.
    const skillDrafts = parseNewSkillDrafts(obj);
    if (skillDrafts.length > 0) {
      await this.ensureSkills(workspaceId, skillDrafts);
    }
    const agentDrafts = parseNewAgentDrafts(obj);
    if (agentDrafts.length > 0) {
      await this.ensureAgents(workspaceId, agentDrafts);
    }
    const cat = await this.catalog(workspaceId);
    const knownAgents = new Set(cat.agents.map((a) => a.name));

    // 기존 Step 은 삭제하지 않는다 — 다른 워크플로/Task 가 참조할 수 있고,
    // 사용자가 Step 라이브러리의 "중복 정리" 도구로 직접 정리할 수 있다.
    const now = Date.now();
    const newStepIds: string[] = [];
    const unknownAgents: string[] = [];
    for (const s of steps) {
      if (!s || typeof s !== 'object') continue;
      const so = s as Record<string, unknown>;
      const sName = typeof so.name === 'string' ? so.name.trim() : '';
      const sDesc = typeof so.description === 'string' ? so.description : '';
      const sAgent = typeof so.agentName === 'string' ? so.agentName.trim() : '';
      if (!sName || !sAgent) continue;
      if (!knownAgents.has(sAgent)) {
        unknownAgents.push(`${sName} → ${sAgent}`);
        continue;
      }
      const step: Step = {
        id: newId(),
        name: sName,
        description: sDesc,
        agentNames: [sAgent],
        createdAt: now,
        updatedAt: now,
      };
      await r.writeStep(step);
      newStepIds.push(step.id);
    }
    if (newStepIds.length === 0) {
      const detail = unknownAgents.length
        ? ` — 카탈로그에 없는 에이전트가 참조됨: ${unknownAgents.join(', ')} (newAgents 정의 누락)`
        : '';
      throw new ApiError(
        'VALIDATION',
        `유효한 Step이 한 개도 없습니다 (name/agentName 누락)${detail}`,
      );
    }

    const next: Workflow = {
      ...cur,
      name,
      description,
      stepIds: newStepIds,
      updatedAt: Date.now(),
    };
    await r.writeWorkflow(next);
    this.notify.notify(workspaceId, ['step', 'workflow']);

    // 드래프트 파일 archive.
    try {
      const archived = path.join(
        root,
        '.claude',
        'workOS',
        'workflow-edits',
        `${draftId}.imported.json`,
      );
      await fs.rename(outPath, archived);
    } catch {
      // ignore
    }

    return { workflowId: cur.id };
  }

  // -------- Catalog --------
  async catalog(workspaceId: string): Promise<CatalogResponse> {
    const root = await this.cwd.resolveCwd(workspaceId);
    const agents = await readMarkdownCatalog(path.join(root, '.claude', 'agents'));
    const skills = await readMarkdownCatalog(path.join(root, '.claude', 'skills'));
    return { agents, skills };
  }

  /**
   * 새 에이전트 .md 파일들을 워크스페이스 .claude/agents/ 에 생성한다.
   * 이미 같은 이름의 파일이 있으면 건너뛴다 (덮어쓰지 않음).
   */
  async ensureAgents(
    workspaceId: string,
    drafts: Array<{
      name: string;
      description: string;
      prompt: string;
      model?: string;
    }>,
  ): Promise<{ created: string[]; skipped: string[] }> {
    const created: string[] = [];
    const skipped: string[] = [];
    if (drafts.length === 0) return { created, skipped };
    const root = await this.cwd.resolveCwd(workspaceId);
    const dir = path.join(root, '.claude', 'agents');
    await fs.mkdir(dir, { recursive: true });
    for (const d of drafts) {
      const safeName = d.name.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(safeName)) {
        throw new ApiError(
          'VALIDATION',
          `에이전트 이름이 올바르지 않습니다: '${d.name}' (소문자/숫자/하이픈)`,
        );
      }
      const file = path.join(dir, `${safeName}.md`);
      try {
        await fs.access(file);
        skipped.push(safeName);
        continue;
      } catch {
        // 파일 없음 — 생성으로 진행
      }
      const desc = d.description.replace(/\r?\n/g, ' ').trim();
      const rawModel = (d.model ?? '').trim().toLowerCase();
      // Claude Code 의 agent frontmatter 가 인식하는 값만 통과 — 미지정/오타는 sonnet 으로 안전 fallback.
      const model =
        rawModel === 'haiku' || rawModel === 'sonnet' || rawModel === 'opus'
          ? rawModel
          : 'sonnet';
      const body = [
        '---',
        `name: ${safeName}`,
        `description: ${JSON.stringify(desc)}`,
        `model: ${model}`,
        '---',
        '',
        d.prompt.trim(),
        '',
      ].join('\n');
      await fs.writeFile(file, body, 'utf-8');
      created.push(safeName);
    }
    return { created, skipped };
  }

  /**
   * 새 스킬 .md 파일들을 워크스페이스 .claude/skills/ 에 생성한다.
   * 이미 같은 이름의 파일이 있으면 건너뛴다 (덮어쓰지 않음).
   * 에이전트가 따라야 할 원칙/컨벤션을 캡슐화한다.
   */
  async ensureSkills(
    workspaceId: string,
    drafts: Array<{ name: string; description: string; body: string }>,
  ): Promise<{ created: string[]; skipped: string[] }> {
    const created: string[] = [];
    const skipped: string[] = [];
    if (drafts.length === 0) return { created, skipped };
    const root = await this.cwd.resolveCwd(workspaceId);
    const dir = path.join(root, '.claude', 'skills');
    await fs.mkdir(dir, { recursive: true });
    for (const d of drafts) {
      const safeName = d.name.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(safeName)) {
        throw new ApiError(
          'VALIDATION',
          `스킬 이름이 올바르지 않습니다: '${d.name}' (소문자/숫자/하이픈)`,
        );
      }
      const file = path.join(dir, `${safeName}.md`);
      try {
        await fs.access(file);
        skipped.push(safeName);
        continue;
      } catch {
        // 파일 없음 — 생성
      }
      const desc = d.description.replace(/\r?\n/g, ' ').trim();
      const body = [
        '---',
        `name: ${safeName}`,
        `description: ${JSON.stringify(desc)}`,
        '---',
        '',
        d.body.trim(),
        '',
      ].join('\n');
      await fs.writeFile(file, body, 'utf-8');
      created.push(safeName);
    }
    return { created, skipped };
  }

  // -------- Git --------
  async gitDiff(workspaceId: string): Promise<GitDiffResponse> {
    const cwd = await this.cwd.resolveCwd(workspaceId);
    try {
      const [{ stdout: diffOut }, { stdout: nameStatus }] = await Promise.all([
        execP('git diff HEAD', { cwd, maxBuffer: 16 * 1024 * 1024 }),
        execP('git status --porcelain', { cwd, maxBuffer: 4 * 1024 * 1024 }),
      ]);
      const changedFiles = nameStatus
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/^.{1,2}\s+/, ''));
      return {
        diff: diffOut,
        hasChanges: diffOut.trim().length > 0 || changedFiles.length > 0,
        changedFiles,
      };
    } catch (err) {
      throw new ApiError('INTERNAL', `git diff 실패: ${(err as Error).message}`);
    }
  }

  async gitCommit(workspaceId: string, message: string): Promise<GitCommitResponse> {
    const cwd = await this.cwd.resolveCwd(workspaceId);
    // index 가 비어 있으면 의미 없는 빈 커밋 시도를 막는다 (DiffView 에서 staged 파일만 커밋).
    try {
      const { stdout: staged } = await execFileP(
        'git',
        ['diff', '--cached', '--name-only'],
        { cwd, maxBuffer: 4 * 1024 * 1024 },
      );
      if (!staged.trim()) {
        throw new ApiError(
          'VALIDATION',
          '스테이지된 파일이 없습니다. 커밋할 파일을 먼저 stage 하세요.',
        );
      }
      await execFileP('git', ['commit', '-m', message], { cwd });
      const { stdout } = await execFileP('git', ['rev-parse', 'HEAD'], { cwd });
      return { commitSha: stdout.trim() };
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw new ApiError('INTERNAL', `git commit 실패: ${(err as Error).message}`);
    }
  }

  async gitStatus(workspaceId: string): Promise<GitStatusResponse> {
    const cwd = await this.cwd.resolveCwd(workspaceId);
    try {
      const { stdout } = await execFileP(
        'git',
        [
          '-c',
          'core.quotepath=false',
          'status',
          '--porcelain=v1',
          '--untracked-files=all',
        ],
        { cwd, maxBuffer: 8 * 1024 * 1024 },
      );
      const files = parsePorcelain(stdout);
      const hasStaged = files.some((f) => f.staged);
      return { files, hasChanges: files.length > 0, hasStaged };
    } catch (err) {
      throw new ApiError('INTERNAL', `git status 실패: ${(err as Error).message}`);
    }
  }

  async gitFileDiff(
    workspaceId: string,
    filePath: string,
    side: 'staged' | 'unstaged',
  ): Promise<GitFileDiffResponse> {
    const cwd = await this.cwd.resolveCwd(workspaceId);
    try {
      // untracked 파일은 git diff 에 잡히지 않으므로 별도 처리.
      const isUntracked = side === 'unstaged' && (await isUntrackedFile(cwd, filePath));
      let diff = '';
      let isBinary = false;
      if (isUntracked) {
        // /dev/null 과 비교 → 전체가 added 로 표현됨. exit code 1 정상.
        try {
          const { stdout } = await execFileP(
            'git',
            ['-c', 'core.quotepath=false', 'diff', '--no-color', '--no-index', '--', '/dev/null', filePath],
            { cwd, maxBuffer: 16 * 1024 * 1024 },
          );
          diff = stdout;
        } catch (e) {
          const er = e as NodeJS.ErrnoException & { stdout?: string };
          // exit code 1 == 차이 있음. stdout 사용.
          if (typeof er.stdout === 'string') diff = er.stdout;
          else throw e;
        }
      } else {
        const args = ['-c', 'core.quotepath=false', 'diff', '--no-color'];
        if (side === 'staged') args.push('--cached');
        args.push('--', filePath);
        const { stdout } = await execFileP('git', args, {
          cwd,
          maxBuffer: 16 * 1024 * 1024,
        });
        diff = stdout;
      }
      if (diff.includes('Binary files ') && diff.includes(' differ')) {
        isBinary = true;
      }
      return { path: filePath, side, diff, isBinary };
    } catch (err) {
      throw new ApiError('INTERNAL', `git diff 실패: ${(err as Error).message}`);
    }
  }

  async gitStagePaths(workspaceId: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const cwd = await this.cwd.resolveCwd(workspaceId);
    try {
      await execFileP('git', ['add', '--', ...paths], { cwd });
    } catch (err) {
      throw new ApiError('INTERNAL', `git add 실패: ${(err as Error).message}`);
    }
  }

  async gitUnstagePaths(workspaceId: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const cwd = await this.cwd.resolveCwd(workspaceId);
    try {
      // 빈 트리(첫 커밋 전)에서는 reset HEAD 가 실패하므로 fallback.
      try {
        await execFileP('git', ['reset', 'HEAD', '--', ...paths], { cwd });
      } catch {
        await execFileP('git', ['rm', '--cached', '--', ...paths], { cwd });
      }
    } catch (err) {
      throw new ApiError('INTERNAL', `git unstage 실패: ${(err as Error).message}`);
    }
  }
}

async function isUntrackedFile(cwd: string, filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileP(
      'git',
      ['ls-files', '--error-unmatch', '--', filePath],
      { cwd },
    );
    void stdout;
    return false;
  } catch {
    return true;
  }
}

/** Jira status name → TaskItem status. 정규화된 fallback 테이블 — 매핑 없으면 null. */
const JIRA_STATUS_TO_TASKITEM: Record<string, TaskItemStatus> = {
  'to do': 'pending',
  'todo': 'pending',
  'open': 'pending',
  'backlog': 'pending',
  'in progress': 'running',
  'in review': 'running',
  'review': 'running',
  'doing': 'running',
  'done': 'completed',
  'closed': 'completed',
  'resolved': 'completed',
  'cancelled': 'skipped',
  'canceled': 'skipped',
  "won't do": 'failed',
  'rejected': 'failed',
};

function mapJiraStatusToTaskItem(jiraStatusName: string): TaskItemStatus | null {
  return JIRA_STATUS_TO_TASKITEM[jiraStatusName.trim().toLowerCase()] ?? null;
}

function parsePorcelain(out: string): FileChange[] {
  const result: FileChange[] = [];
  for (const raw of out.split('\n')) {
    if (raw.length < 3) continue;
    const x = raw[0];
    const y = raw[1];
    let rest = raw.slice(3);
    let oldPath: string | undefined;
    let path = rest;
    if (x === 'R' || x === 'C') {
      const arrow = rest.indexOf(' -> ');
      if (arrow >= 0) {
        oldPath = unquoteIfNeeded(rest.slice(0, arrow));
        path = rest.slice(arrow + 4);
      }
    }
    path = unquoteIfNeeded(path);
    const kind = deriveKind(x, y);
    const staged = x !== ' ' && x !== '?';
    const unstaged = y !== ' ' || x === '?';
    result.push({
      path,
      oldPath,
      kind,
      indexStatus: x,
      worktreeStatus: y,
      staged,
      unstaged,
    });
  }
  return result;
}

function deriveKind(x: string, y: string): FileChangeKind {
  if (x === '?' && y === '?') return 'untracked';
  if (x === 'R' || y === 'R') return 'renamed';
  if (x === 'A' && y === ' ') return 'added';
  if (x === 'D' || y === 'D') return 'deleted';
  if (x === 'M' || y === 'M' || x === 'A') return 'modified';
  return 'unknown';
}

function unquoteIfNeeded(p: string): string {
  if (p.startsWith('"') && p.endsWith('"')) {
    // 안전망: core.quotepath=false 를 줬으니 보통 따옴표 없음. 발생 시 단순 strip.
    return p.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return p;
}

function buildSeedPrompt(
  step: { name: string; description: string },
  task: { title: string; requirement: string },
  agentName: string,
): string {
  return [
    `# Step: ${step.name}`,
    '',
    `Agent: ${agentName}`,
    '',
    `## Task Title`,
    task.title,
    '',
    `## Requirement (원본 요구사항)`,
    task.requirement || '(비어 있음 — Task에 요구사항을 채워주세요)',
    '',
    `## Step 책임 / 설명`,
    step.description || '(이 스텝의 설명이 비어 있습니다. Step 편집에서 책임을 명확히 정의해 주세요.)',
    '',
    `## 지시 사항`,
    '- 위 요구사항 중 이 Step의 책임 범위에 해당하는 부분만 수행하세요.',
    '- 회사 컨벤션·정해진 패턴을 준수하세요 (관련 스킬이 자동으로 적용됩니다).',
    '- 작업이 끝나면 변경 사항을 요약해 한국어로 보고하세요.',
    '',
  ].join('\n');
}

/**
 * Header injected into every MCP-aware prompt so Claude knows to push status
 * back via workos-agent MCP tools instead of staying silent.
 */
function mcpInstructions(opts: { taskItemId?: string; taskId?: string; draftId?: string }): string {
  const lines = [
    '## 🔌 워크OS MCP 연동 (필수)',
    '',
    '이 작업은 워크OS MCP 서버(`workos-agent`)에 연결되어 있습니다.',
    '아래 도구를 호출해 상태를 보고하세요. **파일/터미널 출력은 보조 수단이며, 상태 푸시는 MCP 도구로만 인정됩니다.**',
    '',
  ];
  if (opts.taskItemId) {
    lines.push(
      `- 식별자: **taskItemId = "${opts.taskItemId}"** (모든 TaskItem 도구의 인자로 사용)`,
      '- 시작 직후: `workos_taskitem_progress({ taskItemId, message: "시작" })`',
      '- 의미있는 단위마다: `workos_taskitem_progress({ taskItemId, message: "..." })`',
      '- 정상 종료: `workos_taskitem_complete({ taskItemId, output: "결과 한 줄 요약" })`',
      '- 실패: `workos_taskitem_fail({ taskItemId, error: "에러 메시지" })`',
      '- 컨텍스트가 필요하면: `workos_task_context_get({ taskItemId })`',
      '- 작업 결과로 후속 TaskItem 이 필요하면: `workos_taskitem_add({ taskItemId, items: [{ name, agentName, prompt, description?, stepId? }] })`',
      '  → 같은 Task 에 항목이 추가되고, complete 후 `workos_taskitem_run_next` 가 자동으로 픽업합니다.',
    );
  }
  if (opts.taskId) {
    lines.push(
      `- 분해 결과 제출: \`workos_decomposition_submit({ taskId: "${opts.taskId}", items: [...] })\``,
      '  → 호출이 성공하면 더 이상 파일을 쓸 필요 없습니다.',
    );
  }
  if (opts.draftId) {
    lines.push(
      `- 워크플로 드래프트 제출: \`workos_workflow_draft_submit({ draftId: "${opts.draftId}", name, description, steps })\``,
      '  → 호출이 성공하면 더 이상 파일을 쓸 필요 없습니다.',
    );
  }
  lines.push(
    '- 알림이 필요하면: `workos_notify({ level: "info"|"warn"|"error", message: "..." })`',
    '',
    'MCP 도구가 실패하면 fallback 으로 기존 파일 작성 방식을 사용해도 됩니다.',
    '',
  );
  return lines.join('\n');
}

function parseNewAgentDrafts(
  obj: Record<string, unknown>,
): Array<{ name: string; description: string; prompt: string; model?: string }> {
  const raw = Array.isArray(obj.newAgents) ? obj.newAgents : [];
  const out: Array<{ name: string; description: string; prompt: string; model?: string }> = [];
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue;
    const ao = a as Record<string, unknown>;
    const name = typeof ao.name === 'string' ? ao.name.trim() : '';
    const description = typeof ao.description === 'string' ? ao.description.trim() : '';
    const prompt = typeof ao.prompt === 'string' ? ao.prompt.trim() : '';
    const model = typeof ao.model === 'string' ? ao.model.trim() : undefined;
    if (!name || !description || !prompt) continue;
    out.push({ name, description, prompt, model });
  }
  return out;
}

function parseNewSkillDrafts(
  obj: Record<string, unknown>,
): Array<{ name: string; description: string; body: string }> {
  const raw = Array.isArray(obj.newSkills) ? obj.newSkills : [];
  const out: Array<{ name: string; description: string; body: string }> = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const so = s as Record<string, unknown>;
    const name = typeof so.name === 'string' ? so.name.trim() : '';
    const description = typeof so.description === 'string' ? so.description.trim() : '';
    const body = typeof so.body === 'string' ? so.body.trim() : '';
    if (!name || !description || !body) continue;
    out.push({ name, description, body });
  }
  return out;
}

async function readMarkdownCatalog(
  dir: string,
): Promise<Array<{ name: string; description?: string }>> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    return [];
  }
  const out: Array<{ name: string; description?: string }> = [];
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    const id = name.slice(0, -3);
    const file = path.join(dir, name);
    try {
      const buf = await fs.readFile(file, 'utf-8');
      out.push({ name: id, description: extractDescription(buf) });
    } catch {
      out.push({ name: id });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function extractDescription(md: string): string | undefined {
  // frontmatter description
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm) {
    const m = fm[1].match(/^description:\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  // 첫 줄 (heading 제외)
  const lines = md.split('\n').slice(0, 20);
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if (t.startsWith('#')) continue;
    return t.slice(0, 200);
  }
  return undefined;
}
