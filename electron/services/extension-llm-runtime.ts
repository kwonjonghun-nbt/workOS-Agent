import { ApiError } from '../infra/error';

const LOG = (...a: unknown[]) => console.log('[ext-llm-runtime]', ...a);

type Pending = {
  resolve: (content: string) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

/**
 * Tracks AI requests that an extension's terminal-launched `claude` session is
 * expected to complete by calling the `workos_extension_llm_result` MCP tool.
 *
 * Lifecycle:
 *  - `register(requestId, timeoutMs)` returns a Promise the caller awaits
 *  - MCP control plane invokes `submit(requestId, { content | error })` when
 *    claude finishes, resolving/rejecting the Promise
 *  - On timeout the Promise rejects and the entry is dropped
 */
export class ExtensionLlmRuntime {
  private readonly pending = new Map<string, Pending>();

  register(requestId: string, timeoutMs: number): Promise<string> {
    if (this.pending.has(requestId)) {
      throw new ApiError('VALIDATION', `duplicate llm requestId: ${requestId}`);
    }
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(requestId)) {
          LOG('timeout', requestId);
          reject(
            new ApiError(
              'INTERNAL',
              `claude 작업이 ${timeoutMs}ms 내에 결과를 제출하지 않았습니다.`,
            ),
          );
        }
      }, timeoutMs);
      timer.unref?.();
      this.pending.set(requestId, { resolve, reject, timer });
    });
  }

  /** Called by MCP control plane when claude reports back. */
  submit(
    requestId: string,
    payload: { content?: string; error?: string },
  ): { accepted: boolean } {
    const entry = this.pending.get(requestId);
    if (!entry) {
      LOG('no pending for requestId=', requestId);
      return { accepted: false };
    }
    this.pending.delete(requestId);
    clearTimeout(entry.timer);
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      entry.reject(new ApiError('INTERNAL', `extension llm error: ${payload.error.trim()}`));
    } else if (typeof payload.content === 'string') {
      entry.resolve(payload.content);
    } else {
      entry.reject(
        new ApiError('VALIDATION', 'workos_extension_llm_result: content 또는 error 가 필요'),
      );
    }
    return { accepted: true };
  }

  /** Hard cancel — used on app shutdown. */
  cancelAll(reason = 'app shutdown'): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new ApiError('INTERNAL', `cancelled: ${reason}`));
      this.pending.delete(id);
    }
  }
}
