import { randomUUID } from 'node:crypto';
import type {
  SessionGateOpenEvent,
  SessionGateResolveRequest,
  SessionGateResolveResponse,
  SessionGateResult,
} from '../contracts/session-gate';
import type { SessionGateResolution, SessionGateRuntime } from './session-gate-runtime';

const LOG = (...a: unknown[]) => console.log('[session-gate]', ...a);

export type SessionGateEmitters = {
  /** 모달을 열도록 렌더러에 브로드캐스트. */
  open: (evt: SessionGateOpenEvent) => void;
  /** 해당 요청이 끝났으니 모달을 닫도록 렌더러에 브로드캐스트. */
  close: (requestId: string) => void;
};

/**
 * Session-Start Jira Gate use-case.
 *
 * - {@link beginGate}: SessionStart 훅의 long-poll 진입점. requestId 발급 →
 *   모달 open 브로드캐스트 → 사용자의 결정을 기다렸다가 세션에 주입할
 *   additionalContext 를 만들어 반환.
 * - {@link resolve}: 렌더러가 IPC 로 보낸 사용자 결정을 runtime 으로 전달.
 *
 * Jira 이슈 생성/선택 자체는 렌더러가 기존 jira 레이어(jira:createIssue,
 * jira:listMyIssues)로 끝낸 뒤 최종 이슈만 넘기므로 이 서비스는 Jira 에 의존하지
 * 않는다.
 */
export class SessionGateService {
  constructor(
    private readonly runtime: SessionGateRuntime,
    private readonly emit: SessionGateEmitters,
    private readonly timeoutMs: number,
  ) {}

  async beginGate(input: {
    workspaceId: string;
    cwd: string;
    source: string;
  }): Promise<SessionGateResult> {
    const requestId = randomUUID().replace(/-/g, '');
    LOG('beginGate', requestId, 'cwd=', input.cwd, 'source=', input.source);
    this.emit.open({
      requestId,
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      source: input.source,
    });
    try {
      const resolution = await this.runtime.register(requestId, this.timeoutMs);
      return buildResult(resolution);
    } finally {
      this.emit.close(requestId);
    }
  }

  resolve(req: SessionGateResolveRequest): SessionGateResolveResponse {
    const resolution: SessionGateResolution =
      req.choice === 'skip'
        ? { choice: 'skip' }
        : {
            choice: req.choice,
            key: req.issue.key,
            summary: req.issue.summary,
            url: req.issue.url,
          };
    return this.runtime.submit(req.requestId, resolution);
  }
}

function buildResult(r: SessionGateResolution): SessionGateResult {
  if (r.choice === 'skip') {
    return { additionalContext: '', ticketKey: null };
  }
  const lines = [
    `이 세션은 Jira 티켓 **${r.key}**${r.summary ? ` — ${r.summary}` : ''} 작업입니다.`,
    r.url ? `티켓 링크: ${r.url}` : '',
    `이 티켓의 범위에 맞춰 작업하고, 브랜치/커밋/PR 에 \`${r.key}\` 를 포함하세요.`,
  ].filter((l) => l !== '');
  return { additionalContext: lines.join('\n'), ticketKey: r.key };
}
