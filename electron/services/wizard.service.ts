import { newId } from '../domain/ids';
import { ApiError } from '../infra/error';
import { WizardRepository } from '../repositories/wizard.repo';
import type {
  WizardAction,
  WizardMessage,
  WizardPhase,
  WizardProposal,
  WizardSession,
} from '../contracts/wizard';
import type { WorkOSService } from './workOS.service';
import type { Workflow } from '../contracts/workOS';
import type { LlmCliRepository } from '../repositories/llm-cli.repo';

export type CwdResolver = { resolveCwd(workspaceId: string): Promise<string> };
export type WizardNotifier = { updated(workspaceId: string): void };

/**
 * 자비스 위저드 — 대화 + 워크플로 자동 진행 오케스트레이션.
 *
 * 핵심 책임:
 * - 사용자 메시지를 받아 다음 응답/액션을 결정 (intent 파싱 → 액션 매핑)
 * - 워크플로 추천 → Task 생성 → AI 분해 → 단계별 실행을 큐로 묶어 진행
 * - TaskItem complete 이벤트를 받아 검토 메시지를 자동 push (notifyTaskItemCompleted)
 *
 * 1차(A) 스켈레톤: LLM 호출 없이 슬래시 명령 / 키워드만 처리.
 *   - "/다음" or "다음 진행" → proceedNext
 *   - "/상황" or "현재까지 진행상황" → 진행 상황 텍스트 응답
 *   - "/취소" or "/초기화" → reset
 *   - 그 외 자유텍스트 → "B 단계에서 LLM 의도 파싱이 연결됩니다" 안내
 */
export class WizardService {
  private readonly cache = new Map<string, WizardRepository>();

  constructor(
    private readonly cwd: CwdResolver,
    private readonly workOS: WorkOSService,
    private readonly notify: WizardNotifier,
    private readonly llm: LlmCliRepository,
  ) {}

  private async repo(workspaceId: string): Promise<WizardRepository> {
    const root = await this.cwd.resolveCwd(workspaceId);
    let r = this.cache.get(root);
    if (!r) {
      r = new WizardRepository(root);
      this.cache.set(root, r);
    }
    return r;
  }

  /** 세션 조회. 없으면 초기 인사 메시지가 들어간 새 세션을 만들어 저장한다. */
  async get(workspaceId: string): Promise<WizardSession> {
    const r = await this.repo(workspaceId);
    const cur = await r.read();
    if (cur) return cur;
    const now = Date.now();
    const session: WizardSession = {
      workspaceId,
      phase: 'idle',
      messages: [
        msg('assistant', '안녕하세요 보스, 어떤 걸 도와드릴까요?'),
        msg(
          'assistant',
          '요구사항·지라 티켓 URL·위키 링크·자유 설명을 자유롭게 적어주시면 가장 적합한 워크플로를 골라 Task로 만들어드립니다.',
        ),
      ],
      createdAt: now,
      updatedAt: now,
    };
    await r.write(session);
    return session;
  }

  async sendMessage(workspaceId: string, text: string): Promise<WizardSession> {
    const session = await this.get(workspaceId);
    const trimmed = text.trim();
    if (!trimmed) throw new ApiError('VALIDATION', '빈 메시지는 보낼 수 없습니다.');

    session.messages.push(msg('user', trimmed));

    // 슬래시/키워드 기반 빠른 라우팅 — 자유텍스트 LLM 파싱은 B 단계에서 추가.
    const intent = parseIntent(trimmed);
    switch (intent) {
      case 'proceed-next':
        await this.handleProceedNext(workspaceId, session);
        break;
      case 'show-progress':
        await this.handleShowProgress(workspaceId, session);
        break;
      case 'reset':
        return this.reset(workspaceId);
      case 'approve':
        if (session.pendingProposal) {
          return this.approveProposal(workspaceId);
        }
        session.messages.push(
          msg('assistant', '아직 승인할 제안이 없습니다. 먼저 요구사항을 적어주세요.'),
        );
        break;
      case 'help':
        session.messages.push(msg('assistant', helpText()));
        break;
      default:
        await this.handleFreeText(workspaceId, session, trimmed);
    }
    return this.persist(workspaceId, session);
  }

  /**
   * 자유텍스트 → 워크플로 추천. claude CLI 를 호출해 추천 JSON 을 받아
   * pendingProposal 로 저장하고 사용자 승인 메시지를 띄운다.
   */
  private async handleFreeText(
    workspaceId: string,
    session: WizardSession,
    userText: string,
  ): Promise<void> {
    const workflows = await this.workOS.listWorkflows(workspaceId);
    if (workflows.length === 0) {
      session.messages.push(
        msg(
          'assistant',
          '아직 워크플로가 없습니다. 먼저 **워크플로** 탭에서 워크플로를 만들거나 샘플을 생성한 뒤 다시 말씀해 주세요.',
        ),
      );
      session.phase = 'idle';
      return;
    }

    session.phase = 'gathering';
    session.messages.push(msg('assistant', '🧠 적합한 워크플로를 분석 중…'));
    // 분석에 수십 초 걸릴 수 있어 사용자에게 즉시 진행 표시를 보이도록 미리 flush.
    await this.persist(workspaceId, session);

    let recommendation: Recommendation | null = null;
    try {
      recommendation = await this.recommendWorkflow(userText, workflows);
    } catch (err) {
      session.messages.push(
        msg(
          'assistant',
          `워크플로 추천에 실패했습니다: ${(err as Error).message}\n나중에 다시 시도하시거나 워크플로 탭에서 수동으로 Task 를 만들어 주세요.`,
        ),
      );
      session.phase = 'idle';
      return;
    }

    if (!recommendation || recommendation.kind === 'no-match') {
      session.messages.push(
        msg(
          'assistant',
          recommendation?.suggestion ??
            '입력하신 요구사항에 맞는 워크플로를 찾지 못했습니다. 워크플로 탭에서 적합한 워크플로를 새로 만들어 보세요.',
        ),
      );
      session.phase = 'idle';
      return;
    }

    const wf = workflows.find((w) => w.id === recommendation!.workflowId);
    if (!wf) {
      session.messages.push(
        msg(
          'assistant',
          'AI 가 추천한 워크플로 ID 가 유효하지 않습니다. 다시 시도해 주세요.',
        ),
      );
      session.phase = 'idle';
      return;
    }

    const proposal: WizardProposal = {
      workflowId: wf.id,
      workflowName: wf.name,
      title: recommendation.title,
      requirement: recommendation.requirement || userText,
      reasoning: recommendation.reasoning,
    };
    session.pendingProposal = proposal;
    session.phase = 'proposing';
    session.messages.push(
      msg(
        'assistant',
        [
          `💡 **'${wf.name}'** 워크플로가 가장 적합해 보입니다.`,
          ``,
          `**Task 제목**: ${proposal.title}`,
          proposal.reasoning ? `\n**판단 근거**: ${proposal.reasoning}` : '',
          ``,
          `이 워크플로로 Task 를 만들고 AI 분해까지 진행할까요?`,
        ]
          .filter(Boolean)
          .join('\n'),
        [{ kind: 'approve-proposal' }, { kind: 'reject-proposal' }],
      ),
    );
  }

  private async recommendWorkflow(
    userText: string,
    workflows: Workflow[],
  ): Promise<Recommendation | null> {
    const catalog = workflows
      .map((w) => `- id=${w.id} | name="${w.name}" | desc="${(w.description ?? '').slice(0, 200)}"`)
      .join('\n');
    const prompt = [
      '당신은 워크OS 의 분석 보조 에이전트입니다.',
      '사용자가 자연어로 요구사항을 적었습니다. 아래 워크플로 카탈로그에서 가장 적합한 1개를 선택하세요.',
      '맞는 것이 없으면 noMatch=true 로 응답하세요.',
      '',
      '## 워크플로 카탈로그',
      catalog,
      '',
      '## 사용자 요구사항',
      userText,
      '',
      '## 출력 형식 (JSON 한 덩어리만, 코드펜스/설명 없이)',
      '{"workflowId": "...", "title": "20자 이내 Task 제목", "requirement": "Task 분해 시 사용될 요구사항(원문 풍부화 가능)", "reasoning": "왜 이 워크플로가 적합한지 한 줄"}',
      '또는',
      '{"noMatch": true, "suggestion": "맞는 워크플로가 없는 이유 + 제안 한 줄"}',
    ].join('\n');

    const raw = await this.llm.runText(prompt, { timeoutMs: 60_000 });
    return parseRecommendation(raw);
  }

  async approveProposal(workspaceId: string): Promise<WizardSession> {
    const session = await this.get(workspaceId);
    const proposal = session.pendingProposal;
    if (!proposal) {
      throw new ApiError('VALIDATION', '승인할 제안이 없습니다.');
    }
    try {
      const task = await this.workOS.createTask({
        workspaceId,
        workflowId: proposal.workflowId,
        title: proposal.title,
        requirement: proposal.requirement,
      });
      session.currentTaskId = task.id;
      session.pendingProposal = undefined;
      session.phase = 'executing';
      session.messages.push(
        msg(
          'assistant',
          `✅ Task **'${task.title}'** 생성 완료. 이어서 AI 분해를 시작합니다…`,
          [{ kind: 'open-task', taskId: task.id }],
        ),
      );

      // AI 분해 시작 — 별도 터미널에서 claude 가 분해 JSON 을 만든다.
      // 완료되면 MCP submit_decomposition 로 자동 적용되므로 위저드는 그저 안내만.
      try {
        await this.workOS.requestAiDecomposition(workspaceId, task.id, 120, 30);
        session.messages.push(
          msg(
            'assistant',
            '🧠 AI 가 단계 분해를 진행 중입니다. 완료되면 자동으로 첫 단계를 실행할게요.',
            [{ kind: 'show-progress' }],
          ),
        );
      } catch (err) {
        session.messages.push(
          msg(
            'assistant',
            `AI 분해 시작 실패: ${(err as Error).message}\nTask 탭에서 수동으로 분해를 진행해 주세요.`,
          ),
        );
      }
      return this.persist(workspaceId, session);
    } catch (err) {
      session.messages.push(
        msg('assistant', `Task 생성 실패: ${(err as Error).message}`),
      );
      return this.persist(workspaceId, session);
    }
  }

  async rejectProposal(workspaceId: string): Promise<WizardSession> {
    const session = await this.get(workspaceId);
    session.pendingProposal = undefined;
    session.phase = 'idle';
    session.messages.push(
      msg('assistant', '제안을 취소했습니다. 다시 요구사항을 적어주세요.'),
    );
    return this.persist(workspaceId, session);
  }

  async proceedNext(workspaceId: string): Promise<WizardSession> {
    const session = await this.get(workspaceId);
    await this.handleProceedNext(workspaceId, session);
    return this.persist(workspaceId, session);
  }

  async reset(workspaceId: string): Promise<WizardSession> {
    const r = await this.repo(workspaceId);
    await r.clear();
    // 알림을 먼저 쏘면 렌더러가 곧바로 wizard:get refetch 를 트리거하고,
    // 그 호출이 아래 get() 의 내부 write 와 같은 .tmp 파일을 두고 경합한다 → ENOENT rename.
    // write 가 완료된 뒤에 알림을 보내 경합을 제거한다.
    const session = await this.get(workspaceId);
    this.notify.updated(workspaceId);
    return session;
  }

  /**
   * 외부에서 호출 — TaskItem 이 완료되면 위저드에 검토 메시지를 push 한다.
   * WorkOSService.mcpComplete 에서 hook 으로 호출될 예정 (C 단계).
   * 현재 세션의 currentTaskId / currentItemId 와 연결된 항목인 경우에만 반응.
   */
  async notifyTaskItemCompleted(
    workspaceId: string,
    taskItemId: string,
    output?: string,
  ): Promise<void> {
    const r = await this.repo(workspaceId);
    const session = await r.read();
    if (!session) return; // 아직 위저드가 활성화되지 않음.
    if (session.currentItemId !== taskItemId) return;

    // step 이름을 조회해 자연어 메시지에 포함.
    let label = '단계';
    try {
      const items = await this.workOS.listTaskItems(workspaceId);
      const item = items.find((i) => i.id === taskItemId);
      if (item) label = item.name;
    } catch {
      // 조회 실패해도 메시지는 만들어준다.
    }

    const summary = output && output.trim() ? `\n\n결과 요약: ${output.trim()}` : '';
    session.messages.push(
      msg(
        'assistant',
        `✅ **'${label}'** 완료되었습니다 보스, 검토해 주세요.${summary}\n\n다음 단계로 진행할까요?`,
        [{ kind: 'proceed-next' }, { kind: 'show-progress' }],
      ),
    );
    session.phase = 'reviewing';
    session.currentItemId = undefined;
    await r.write(session);
    this.notify.updated(workspaceId);
  }

  // --- internals ----------------------------------------------------------

  private async handleProceedNext(
    workspaceId: string,
    session: WizardSession,
  ): Promise<void> {
    if (!session.currentTaskId) {
      session.messages.push(
        msg('assistant', '진행 중인 Task 가 없습니다. 먼저 새 작업을 시작해 주세요.'),
      );
      return;
    }
    const tasks = await this.workOS.listTasks(workspaceId);
    const task = tasks.find((t) => t.id === session.currentTaskId);
    if (!task) {
      session.messages.push(
        msg('assistant', '연결된 Task 를 찾을 수 없습니다. `/취소` 후 다시 시작해 주세요.'),
      );
      return;
    }
    if (task.taskItemIds.length === 0) {
      session.messages.push(
        msg(
          'assistant',
          'AI 분해가 아직 완료되지 않았습니다. 잠시 후 다시 `/다음` 을 눌러주세요.',
        ),
      );
      return;
    }
    const items = await this.workOS.listTaskItems(workspaceId);
    const myItems = task.taskItemIds
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => Boolean(i));
    const nextItem = myItems.find((i) => i.status === 'pending');
    if (!nextItem) {
      // 모두 끝났거나 running/failed 만 남았다.
      const allDone = myItems.every((i) => i.status === 'completed' || i.status === 'skipped');
      if (allDone) {
        session.phase = 'done';
        session.currentItemId = undefined;
        session.messages.push(
          msg(
            'assistant',
            `🎉 모든 단계가 완료되었습니다 보스. 수고하셨어요!`,
            [{ kind: 'show-progress' }],
          ),
        );
      } else {
        session.messages.push(
          msg(
            'assistant',
            '대기 중인 단계가 없습니다. 일부 단계가 실행/실패 상태일 수 있어요.',
            [{ kind: 'show-progress' }],
          ),
        );
      }
      return;
    }

    try {
      await this.workOS.executeTaskItem(workspaceId, nextItem.id, 120, 30);
      session.currentItemId = nextItem.id;
      session.phase = 'executing';
      session.messages.push(
        msg(
          'assistant',
          `▶ **'${nextItem.name}'** 실행을 시작했습니다. 터미널에서 진행 상황을 확인하실 수 있어요.\n완료되면 알려드릴게요.`,
        ),
      );
    } catch (err) {
      session.messages.push(
        msg('assistant', `단계 실행 실패: ${(err as Error).message}`),
      );
    }
  }

  private async handleShowProgress(
    workspaceId: string,
    session: WizardSession,
  ): Promise<void> {
    if (!session.currentTaskId) {
      session.messages.push(
        msg(
          'assistant',
          '아직 진행 중인 Task 가 없습니다. 요구사항을 적으시면 워크플로를 골라 Task 를 만들어 드릴게요.',
        ),
      );
      return;
    }
    // D 단계에서 인라인 FlowBoard 임베드. 지금은 텍스트 요약만.
    const tasks = await this.workOS.listTasks(workspaceId);
    const task = tasks.find((t) => t.id === session.currentTaskId);
    if (!task) {
      session.messages.push(msg('assistant', '현재 Task 를 찾을 수 없습니다.'));
      session.currentTaskId = undefined;
      session.currentItemId = undefined;
      return;
    }
    const items = await this.workOS.listTaskItems(workspaceId);
    const my = items.filter((i) => i.taskId === task.id);
    const done = my.filter((i) => i.status === 'completed').length;
    session.messages.push(
      msg(
        'assistant',
        `현재 진행상황: **${task.title}** — ${done}/${my.length} 완료`,
        [{ kind: 'open-task', taskId: task.id }, { kind: 'show-progress' }],
      ),
    );
  }

  private async persist(workspaceId: string, session: WizardSession): Promise<WizardSession> {
    session.updatedAt = Date.now();
    const r = await this.repo(workspaceId);
    await r.write(session);
    this.notify.updated(workspaceId);
    return session;
  }
}

// --- helpers --------------------------------------------------------------

function msg(
  role: 'user' | 'assistant' | 'system',
  text: string,
  actions?: WizardAction[],
): WizardMessage {
  return {
    id: newId(),
    role,
    text,
    at: Date.now(),
    ...(actions && actions.length > 0 ? { actions } : {}),
  };
}

type Intent =
  | 'proceed-next'
  | 'show-progress'
  | 'reset'
  | 'approve'
  | 'help'
  | 'freetext';

function parseIntent(text: string): Intent {
  const t = text.trim().toLowerCase();
  if (t.startsWith('/')) {
    const head = t.slice(1).split(/\s+/)[0];
    if (['next', '다음', '진행', 'proceed'].includes(head)) return 'proceed-next';
    if (['status', '상황', 'progress'].includes(head)) return 'show-progress';
    if (['reset', '취소', '초기화', 'cancel'].includes(head)) return 'reset';
    if (['ok', 'yes', '승인', 'approve'].includes(head)) return 'approve';
    if (['help', '?', '도움', '도움말'].includes(head)) return 'help';
  }
  if (/(다음\s*진행|다음\s*단계|next\s+step)/i.test(text)) return 'proceed-next';
  if (/(현재까지\s*진행상황|진행\s*상황|상황\s*보여|어디까지)/i.test(text)) return 'show-progress';
  if (/(초기화|reset|취소해)/i.test(text)) return 'reset';
  if (/(승인|좋아\s*시작|네\s*시작|네\s*진행|시작해)/i.test(text)) return 'approve';
  return 'freetext';
}

function helpText(): string {
  return [
    '도움말 — 자비스 위저드',
    '',
    '• 자유텍스트(예: "결제 페이지 구현해줘 https://wiki/...") — 워크플로 추천 + Task 생성 (B 단계)',
    '• `/상황` — 현재까지 진행상황 표시',
    '• `/다음` — 다음 단계 진행',
    '• `/취소` — 위저드 초기화',
    '• `/승인` — 현재 제안 승인',
    '',
    '진행 중 단계가 끝나면 자비스가 알아서 "검토해 주세요" 라고 말씀드려요.',
  ].join('\n');
}

// 미사용 import 경고 회피용 — 향후 단계에서 활용 예정.
export type { Workflow, WizardProposal, WizardPhase };

type Recommendation =
  | {
      kind: 'match';
      workflowId: string;
      title: string;
      requirement: string;
      reasoning?: string;
    }
  | { kind: 'no-match'; suggestion: string };

/**
 * claude CLI 응답에서 JSON 블록을 추출하고 파싱. 코드펜스가 끼어도 견디게 한다.
 * 유효한 응답이 아니면 null.
 */
function parseRecommendation(raw: string): Recommendation | null {
  const stripped = raw.trim();
  // ```json ... ``` 또는 ``` ... ``` 제거
  const fenceMatch = stripped.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenceMatch ? fenceMatch[1] : stripped).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // 본문 어딘가에 JSON 객체가 끼어 있는 경우 — 첫 { … } 만 추출 시도.
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      parsed = JSON.parse(body.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  if (o.noMatch === true) {
    return {
      kind: 'no-match',
      suggestion: typeof o.suggestion === 'string' ? o.suggestion : '맞는 워크플로를 찾지 못했습니다.',
    };
  }
  const workflowId = typeof o.workflowId === 'string' ? o.workflowId : '';
  const title = typeof o.title === 'string' ? o.title.trim() : '';
  if (!workflowId || !title) return null;
  return {
    kind: 'match',
    workflowId,
    title,
    requirement: typeof o.requirement === 'string' ? o.requirement : '',
    reasoning: typeof o.reasoning === 'string' ? o.reasoning : undefined,
  };
}
