import { spawn } from 'node:child_process';
import { ApiError } from '../infra/error';

const LOG = (...a: unknown[]) => console.log('[llm-cli]', ...a);

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export interface LlmCliRepository {
  runText(prompt: string, opts?: { model?: string; timeoutMs?: number }): Promise<string>;
}

/**
 * Shells out to the local `claude` CLI. We pipe the prompt via stdin and ask
 * for plain text output so the renderer never has to parse SSE/JSON.
 *
 * Failure modes:
 *  - ENOENT: claude CLI not installed → user-facing hint
 *  - timeout: kill the child and report
 *  - non-zero exit: bubble stderr (trimmed) up
 */
export class ClaudeCliRepository implements LlmCliRepository {
  async runText(
    prompt: string,
    opts: { model?: string; timeoutMs?: number } = {},
  ): Promise<string> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const args = ['-p', '--output-format', 'text'];
    if (opts.model) {
      args.push('--model', opts.model);
    }
    LOG('spawn claude', args.join(' '));
    return new Promise<string>((resolve, reject) => {
      const child = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      child.on('error', (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (err.code === 'ENOENT') {
          reject(
            new ApiError(
              'VALIDATION',
              'claude CLI 를 찾을 수 없습니다. https://docs.claude.com/en/docs/claude-code 를 따라 설치하고 PATH 에 등록해주세요.',
            ),
          );
        } else {
          reject(new ApiError('INTERNAL', `claude CLI 실행 실패: ${err.message}`));
        }
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new ApiError('INTERNAL', `claude CLI 응답이 ${timeoutMs}ms 내에 도착하지 않아 취소했습니다.`));
          return;
        }
        const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
        const stderr = Buffer.concat(stderrChunks).toString('utf-8');
        if (code !== 0) {
          LOG('claude exited code=', code, 'stderr=', stderr.slice(0, 300));
          reject(
            new ApiError(
              'INTERNAL',
              `claude CLI 가 코드 ${code} 로 종료. ${stderr.slice(0, 200).trim()}`,
            ),
          );
          return;
        }
        resolve(stdout);
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}
