import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../infra/error';
import type { LlmCliRepository } from './llm-cli.repo';
import type { TerminalService } from '../services/terminal.service';
import type { WorkspaceService } from '../services/workspace.service';
import type { ExtensionService } from '../services/extension.service';
import type { McpService } from '../services/mcp.service';
import type { ExtensionLlmRuntime } from '../services/extension-llm-runtime';
import { secretFieldKeys } from '../domain/extension';
import { SYSTEM_DEFAULT_WORKSPACE_ID } from '../contracts/workspace';
import { CHANNELS } from '../contracts/channels';
import { eventBus } from '../infra/event-bus';
import type { ExtensionOpenPanelEvent } from '../contracts/extension';

const LOG = (...a: unknown[]) => console.log('[terminal-llm]', ...a);

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const PROMPT_CLEANUP_MS = 30_000;

/**
 * Routes AI CLI calls through the extension's visible terminal panel using the
 * same fire-and-forget pattern as WorkOS task execution:
 *
 *   1. Write the prompt to a temp file in the extension cwd
 *   2. Open / focus the extension AI terminal panel in the UI
 *   3. Type into the PTY:
 *        claude --dangerously-skip-permissions "Read the file at <path> and execute..."
 *   4. Wait for claude to call the `workos_extension_llm_result` MCP tool with
 *      the matching requestId — that resolves the returned Promise
 *
 * The prompt file is auto-deleted after a short delay so the cwd stays clean.
 */
export class TerminalLlmRepository implements LlmCliRepository {
  constructor(
    private readonly extensionId: string,
    private readonly terminalService: TerminalService,
    private readonly workspaceService: WorkspaceService,
    private readonly extensionService: ExtensionService,
    private readonly mcpService: McpService,
    private readonly runtime: ExtensionLlmRuntime,
  ) {}

  async runText(
    prompt: string,
    opts: { model?: string; timeoutMs?: number } = {},
  ): Promise<string> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const enabled = await this.extensionService.isEnabled(this.extensionId);
    if (!enabled) {
      throw new ApiError('VALIDATION', `extension is not enabled: ${this.extensionId}`);
    }
    if (!this.mcpService.isReady()) {
      throw new ApiError(
        'INTERNAL',
        'MCP 서버가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.',
      );
    }

    const cwd = await this.workspaceService.resolveExtensionCwd(
      SYSTEM_DEFAULT_WORKSPACE_ID,
      this.extensionId,
    );

    // Make sure the extension cwd has `.mcp.json` + a fresh session file so
    // claude picks up our MCP server when it launches.
    await this.mcpService.setupAt(cwd, SYSTEM_DEFAULT_WORKSPACE_ID, false);

    // Write the prompt to disk so claude can `Read the file at <path>`.
    const requestId = randomUUID().replace(/-/g, '');
    const ioDir = path.join(cwd, '.workos-llm');
    await fs.mkdir(ioDir, { recursive: true });
    const promptPath = path.join(ioDir, `prompt-${requestId}-${Date.now()}.md`);
    await fs.writeFile(promptPath, wrapPrompt(prompt, requestId, opts.model), 'utf-8');
    scheduleUnlink(promptPath, PROMPT_CLEANUP_MS);

    // Ensure (or reuse) the extension AI terminal session and request the UI
    // to open the panel so the user sees the work happen.
    const envOverride = await this.buildEnv();
    const sessionId = await this.terminalService.ensureExtensionSession(
      SYSTEM_DEFAULT_WORKSPACE_ID,
      this.extensionId,
      cwd,
      envOverride,
    );
    const openEvt: ExtensionOpenPanelEvent = {
      extensionId: this.extensionId,
      sessionId,
    };
    eventBus.broadcast(CHANNELS.extensionEvents.openPanel, openEvt);

    // Send the WorkOS-style one-liner. The slight delay lets the shell finish
    // drawing its prompt so the input doesn't race with prompt drawing.
    const safePath = promptPath.replace(/"/g, '\\"');
    const line =
      `claude --dangerously-skip-permissions ` +
      `"Read the file at ${safePath} and execute the instructions inside as if they were my next request."`;
    setTimeout(() => {
      try {
        this.terminalService.write(sessionId, `${line}\n`);
      } catch (err) {
        LOG('terminal write failed:', err);
      }
    }, 250);

    LOG('await result requestId=', requestId);
    return this.runtime.register(requestId, timeoutMs);
  }

  private async buildEnv(): Promise<Record<string, string>> {
    const settings = await this.extensionService.getSettings(this.extensionId);
    const list = await this.extensionService.list();
    const item = list.find((x) => x.manifest.id === this.extensionId);
    const secrets = item ? secretFieldKeys(item.manifest) : new Set<string>();
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (typeof v !== 'string') continue;
      if (!v) continue;
      if (secrets.has(k) || typeof v === 'string') {
        env[`EXT_${k.toUpperCase()}`] = v;
      }
    }
    return env;
  }
}

function wrapPrompt(prompt: string, requestId: string, model: string | undefined): string {
  return [
    prompt,
    '',
    '---',
    '',
    '# 결과 제출 (필수)',
    '',
    '위 작업의 최종 결과물을 반드시 다음 MCP 도구로 제출하세요:',
    '',
    '```',
    `workos_extension_llm_result({`,
    `  requestId: "${requestId}",`,
    `  content: "<결과 전체 — 마크다운/JSON 등 그대로의 문자열>"`,
    `})`,
    '```',
    '',
    '- content 에는 작업의 최종 결과물 **전체**를 담으세요. 요약/추출/줄임 금지.',
    '- 결과가 마크다운이면 마크다운 전체를, JSON 이면 JSON 문자열 전체를 그대로 담습니다.',
    '- 결과를 별도 파일로 저장할 필요 없습니다 — 이 도구 호출이 곧 결과 전달입니다.',
    '- 진행 도중 치명적 에러로 결과를 만들 수 없으면:',
    '  `workos_extension_llm_result({ requestId: "' + requestId + '", error: "사유" })`',
    '- 같은 requestId 로 두 번 호출하지 마세요. 호출 후 종료하세요.',
    model ? `- 사용 모델: ${model}` : '',
  ]
    .filter((s) => s !== '')
    .join('\n');
}

function scheduleUnlink(file: string, delayMs: number): void {
  const t = setTimeout(() => {
    void fs.unlink(file).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') {
        LOG('prompt cleanup failed:', err.message);
      }
    });
  }, delayMs);
  t.unref?.();
}
