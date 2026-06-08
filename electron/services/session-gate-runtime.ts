import { ApiError } from '../infra/error';

const LOG = (...a: unknown[]) => console.log('[session-gate-runtime]', ...a);

/** 렌더러의 사용자 결정. */
export type SessionGateResolution =
  | { choice: 'create' | 'select'; key: string; summary: string; url: string }
  | { choice: 'skip' };

type Pending = {
  resolve: (r: SessionGateResolution) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * SessionStart 게이트의 pending 요청을 추적한다. {@link ExtensionLlmRuntime} 와
 * 동일한 register/submit(promise) 패턴 — control plane 의 long-poll 핸들러가
 * `register` 한 Promise 를 await 하고, 렌더러가 IPC 로 결정을 보내면 `submit`
 * 이 그 Promise 를 resolve 한다.
 *
 * 타임아웃 시 reject → 호출 측(beginGate)은 에러를 그대로 전파하고, 훅은 이를
 * fail-open(빈 컨텍스트 + 정상 시작)으로 처리한다.
 */
export class SessionGateRuntime {
  private readonly pending = new Map<string, Pending>();

  register(requestId: string, timeoutMs: number): Promise<SessionGateResolution> {
    if (this.pending.has(requestId)) {
      throw new ApiError('VALIDATION', `duplicate session-gate requestId: ${requestId}`);
    }
    return new Promise<SessionGateResolution>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(requestId)) {
          LOG('timeout', requestId);
          reject(
            new ApiError(
              'INTERNAL',
              `세션 게이트가 ${timeoutMs}ms 내에 선택을 받지 못했습니다.`,
            ),
          );
        }
      }, timeoutMs);
      timer.unref?.();
      this.pending.set(requestId, { resolve, reject, timer });
    });
  }

  /** 렌더러가 결정을 보냈을 때 control plane handler 가 호출. */
  submit(requestId: string, resolution: SessionGateResolution): { accepted: boolean } {
    const entry = this.pending.get(requestId);
    if (!entry) {
      LOG('no pending for requestId=', requestId);
      return { accepted: false };
    }
    this.pending.delete(requestId);
    clearTimeout(entry.timer);
    entry.resolve(resolution);
    return { accepted: true };
  }

  /** 앱 종료 시 강제 취소. */
  cancelAll(reason = 'app shutdown'): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new ApiError('INTERNAL', `cancelled: ${reason}`));
      this.pending.delete(id);
    }
  }
}
