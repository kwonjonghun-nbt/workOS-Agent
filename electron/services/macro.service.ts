import { spawn } from 'node:child_process';
import { BrowserWindow, clipboard, dialog, net, shell } from 'electron';
import { eventBus } from '../infra/event-bus';
import { CHANNELS } from '../contracts/channels';
import { ApiError } from '../infra/error';
import { SYSTEM_DEFAULT_WORKSPACE_ID } from '../contracts/workspace';
import type { ExtensionOpenPanelEvent } from '../contracts/extension';
import {
  aiSuggestResponseSchema,
  type DeleteTileRequest,
  type PickPathRequest,
  type PickPathResponse,
  type RunActionResult,
  type RunTileRequest,
  type RunTileResponse,
  type SaveBoardRequest,
  type SuggestTileRequest,
  type SuggestTileResponse,
} from '../contracts/macro';
import {
  MACRO_EXTENSION_ID,
  emptyBoard,
  findBoard,
  findTile,
  isActionTile,
  isGroupTile,
  type MacroAction,
  type MacroBoard,
  type MacroState,
} from '../domain/macro';
import type { LlmCliRepository } from '../repositories/llm-cli.repo';
import type { MacroRepository } from '../repositories/macro.repo';
import type { ExtensionService } from './extension.service';
import type { TerminalService } from './terminal.service';
import type { WorkspaceService } from './workspace.service';

const LOG = (...args: unknown[]) => console.log('[macro.service]', ...args);

export class MacroService {
  private cache: MacroState | null = null;

  constructor(
    private readonly repo: MacroRepository,
    private readonly extensionService: ExtensionService,
    private readonly terminalService: TerminalService,
    private readonly workspaceService: WorkspaceService,
    private readonly llm: LlmCliRepository,
  ) {}

  async getState(): Promise<MacroState> {
    return this.ensureLoaded();
  }

  /**
   * Save (create or replace) a board. Also reconciles sub-boards: any group
   * tile pointing at a board id that does not yet exist gets an empty
   * sub-board auto-created so the user can navigate into it immediately.
   */
  async saveBoard(req: SaveBoardRequest): Promise<MacroState> {
    const state = await this.ensureLoaded();
    const idx = state.boards.findIndex((b) => b.id === req.board.id);
    if (idx === -1) {
      state.boards.push(req.board);
    } else {
      state.boards[idx] = req.board;
    }
    // Create empty sub-boards for any group tile that references a missing
    // target. We use the tile's label as the sub-board's name so navigation
    // breadcrumbs stay meaningful.
    for (const tile of req.board.tiles) {
      if (!isGroupTile(tile)) continue;
      if (state.boards.some((b) => b.id === tile.groupBoardId)) continue;
      state.boards.push(
        emptyBoard(tile.groupBoardId, tile.label || 'Group'),
      );
    }
    // Keep sub-board name in sync with its group tile's label so the
    // breadcrumb shown when navigating in matches the parent label.
    for (const tile of req.board.tiles) {
      if (!isGroupTile(tile)) continue;
      const sub = state.boards.find((b) => b.id === tile.groupBoardId);
      if (sub && tile.label && sub.name !== tile.label) {
        sub.name = tile.label;
      }
    }
    await this.repo.save(state);
    return state;
  }

  async deleteTile(req: DeleteTileRequest): Promise<MacroState> {
    const state = await this.ensureLoaded();
    const board = findBoard(state, req.boardId);
    if (!board) throw new ApiError('NOT_FOUND', `board not found: ${req.boardId}`);
    board.tiles = board.tiles.filter((t) => t.id !== req.tileId);
    // Drop orphan boards no longer reachable from the root. This GCs the
    // sub-board behind a deleted group tile (and any sub-sub-boards reachable
    // only from it).
    gcOrphanBoards(state);
    await this.repo.save(state);
    return state;
  }

  async runTile(req: RunTileRequest): Promise<RunTileResponse> {
    await this.assertEnabled();
    const state = await this.ensureLoaded();
    const board = findBoard(state, req.boardId);
    if (!board) throw new ApiError('NOT_FOUND', `board not found: ${req.boardId}`);
    const tile = findTile(board, req.tileId);
    if (!tile) throw new ApiError('NOT_FOUND', `tile not found: ${req.tileId}`);
    if (!isActionTile(tile)) {
      throw new ApiError('VALIDATION', 'group tile cannot be executed');
    }

    LOG('runTile', tile.label, 'actions=', tile.actions.length);
    const ctx = await this.prepareRunContext(tile.label, req.workspaceId);
    const prompts = req.prompts ?? {};
    const results: RunActionResult[] = [];
    let aborted = false;

    for (let i = 0; i < tile.actions.length; i++) {
      const action = tile.actions[i];
      const resolved = this.resolveAction(action, prompts);
      try {
        const message = await this.runAction(resolved, ctx, i);
        results.push({ index: i, kind: action.kind, ok: true, message });
        this.emit(ctx, `[${i + 1}/${tile.actions.length}] ${action.kind} OK${
          message ? ` — ${message}` : ''
        }`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ index: i, kind: action.kind, ok: false, message: msg });
        this.emit(ctx, `[${i + 1}/${tile.actions.length}] ${action.kind} FAIL — ${msg}`);
        if (!actionAllowsContinue(action)) {
          aborted = true;
          break;
        }
      }
    }

    this.emit(ctx, `=== "${tile.label}" done (${results.length}/${tile.actions.length})`);
    return { tileId: tile.id, aborted, results };
  }

  /**
   * Show a native open dialog so the user can pick an application, a regular
   * file, or a directory for an `os.open` action target. On macOS the default
   * location is `/Applications` and `.app` bundles are selectable.
   */
  async pickPath(req: PickPathRequest): Promise<PickPathResponse> {
    const parent =
      BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
    const options: Electron.OpenDialogOptions =
      req.mode === 'directory'
        ? {
            title: '폴더 선택',
            properties: ['openDirectory'],
          }
        : req.mode === 'app'
          ? {
              title: '애플리케이션 선택',
              properties: ['openFile'],
              defaultPath: process.platform === 'darwin' ? '/Applications' : undefined,
              filters:
                process.platform === 'darwin'
                  ? [
                      { name: 'Applications', extensions: ['app'] },
                      { name: 'All Files', extensions: ['*'] },
                    ]
                  : process.platform === 'win32'
                    ? [{ name: 'Executables', extensions: ['exe', 'bat', 'cmd'] }]
                    : undefined,
            }
          : {
              title: '파일 선택',
              properties: ['openFile'],
            };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) {
      return { path: null };
    }
    return { path: result.filePaths[0] };
  }

  async suggestTile(req: SuggestTileRequest): Promise<SuggestTileResponse> {
    await this.assertEnabled();
    const prompt = buildSuggestPrompt(req.prompt);
    LOG('suggestTile prompt len=', req.prompt.length);
    const text = await this.llm.runText(prompt);
    return parseSuggestResponse(text);
  }

  // -------- internals --------

  private async ensureLoaded(): Promise<MacroState> {
    if (!this.cache) this.cache = await this.repo.load();
    return this.cache;
  }

  private async assertEnabled(): Promise<void> {
    const enabled = await this.extensionService.isEnabled(MACRO_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'Macro Buttons 확장이 비활성화되어 있습니다. Extensions 패널에서 활성화하세요.',
      );
    }
  }

  private async prepareRunContext(
    tileLabel: string,
    workspaceIdHint: string | undefined,
  ): Promise<RunContext> {
    const workspaceId = workspaceIdHint || SYSTEM_DEFAULT_WORKSPACE_ID;
    const cwd = await this.workspaceService.resolveExtensionCwd(
      workspaceId,
      MACRO_EXTENSION_ID,
    );
    const sessionId = await this.terminalService.ensureExtensionSession(
      workspaceId,
      MACRO_EXTENSION_ID,
      cwd,
      {},
    );
    const evt: ExtensionOpenPanelEvent = {
      extensionId: MACRO_EXTENSION_ID,
      sessionId,
    };
    eventBus.broadcast(CHANNELS.extensionEvents.openPanel, evt);
    const ctx: RunContext = { sessionId, workspaceId, cwd };
    this.emit(ctx, `\n=== Running macro: ${tileLabel} ===`);
    return ctx;
  }

  private emit(ctx: RunContext, line: string): void {
    this.terminalService.appendSessionData(ctx.sessionId, `\r\n${line}\r\n`);
  }

  private async runAction(
    action: MacroAction,
    ctx: RunContext,
    index: number,
  ): Promise<string | undefined> {
    switch (action.kind) {
      case 'shell':
        this.terminalService.write(ctx.sessionId, `${action.command}\r`);
        return `$ ${truncate(action.command, 80)}`;

      case 'http': {
        const res = await net.fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body,
        });
        const summary = `${action.method} ${action.url} → ${res.status}`;
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`${summary}: ${truncate(text, 200)}`);
        }
        return summary;
      }

      case 'delay':
        await new Promise<void>((resolve) => setTimeout(resolve, action.ms));
        return `${action.ms}ms`;

      case 'os.open': {
        const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(action.target);
        if (isUrl) {
          await shell.openExternal(action.target);
        } else {
          const errMsg = await shell.openPath(action.target);
          if (errMsg) throw new Error(errMsg);
        }
        return truncate(action.target, 80);
      }

      case 'os.clipboard':
        clipboard.writeText(action.text);
        return `${action.text.length} chars`;

      case 'ai': {
        const result = await this.llm.runText(action.prompt);
        if (action.output === 'clipboard') {
          clipboard.writeText(result);
          return `→ clipboard (${result.length} chars)`;
        }
        this.terminalService.appendSessionData(ctx.sessionId, `\r\n${result}\r\n`);
        return `echoed ${result.length} chars`;
      }

      case 'keystroke': {
        if (process.platform !== 'darwin') {
          throw new Error('keystroke 액션은 현재 macOS 만 지원합니다.');
        }
        if (action.app) {
          await runAppleScript([`tell application "${escapeAS(action.app)}" to activate`]);
          // Give the OS a beat to bring the app forward before we send keys.
          await sleep(200);
        }
        for (const step of action.steps) {
          if (step.type === 'wait') {
            await sleep(step.ms);
            continue;
          }
          await runAppleScript(buildKeystrokeAppleScript(step));
          if (step.delayMs) await sleep(step.delayMs);
        }
        return `${action.steps.length} step(s)${action.app ? ` → ${action.app}` : ''}`;
      }
    }
    const _exhaustive: never = action;
    throw new Error(`unknown action at index ${index}: ${JSON.stringify(_exhaustive)}`);
  }

  // ---------------- token substitution ----------------

  private resolveAction(
    action: MacroAction,
    prompts: Record<string, string>,
  ): MacroAction {
    const sub = (s: string) => this.substituteTokens(s, prompts);
    switch (action.kind) {
      case 'shell':
        return { ...action, command: sub(action.command) };
      case 'http':
        return {
          ...action,
          url: sub(action.url),
          body: action.body !== undefined ? sub(action.body) : undefined,
          headers: action.headers
            ? Object.fromEntries(
                Object.entries(action.headers).map(([k, v]) => [k, sub(v)]),
              )
            : undefined,
        };
      case 'os.open':
        return { ...action, target: sub(action.target) };
      case 'os.clipboard':
        return { ...action, text: sub(action.text) };
      case 'ai':
        return { ...action, prompt: sub(action.prompt) };
      case 'keystroke':
        return {
          ...action,
          app: action.app ? sub(action.app) : undefined,
          steps: action.steps.map((step) => {
            if (step.type === 'text') return { ...step, text: sub(step.text) };
            if (step.type === 'keys') return { ...step, keys: sub(step.keys) };
            return step;
          }),
        };
      case 'delay':
        return action;
    }
  }

  private substituteTokens(
    value: string,
    prompts: Record<string, string>,
  ): string {
    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, raw: string) => {
      const token = raw.trim();
      if (token === 'clipboard') return clipboard.readText();
      if (token === 'date') return new Date().toISOString();
      if (token.startsWith('date:')) {
        const fmt = token.slice(5).trim();
        return formatDate(new Date(), fmt);
      }
      if (token === 'prompt') return prompts[''] ?? '';
      if (token.startsWith('prompt:')) {
        const label = token.slice(7).trim();
        return prompts[label] ?? '';
      }
      // Unknown token — leave the literal placeholder so the user can see it
      // in the rendered terminal output and fix it.
      return match;
    });
  }
}

type RunContext = {
  sessionId: string;
  workspaceId: string;
  cwd: string;
};

function actionAllowsContinue(action: MacroAction): boolean {
  if ('continueOnError' in action) return action.continueOnError === true;
  return false;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeAS(s: string): string {
  // AppleScript strings: backslash and quote escape.
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function runAppleScript(lines: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const args: string[] = [];
    for (const l of lines) args.push('-e', l);
    const child = spawn('osascript', args);
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      const trimmed = stderr.trim();
      if (/not allowed (assistive|to send keystrokes)/i.test(trimmed)) {
        reject(
          new Error(
            'Accessibility 권한이 필요합니다. 시스템 설정 > 개인정보 보호 및 보안 > 손쉬운 사용 에서 이 앱을 허용하세요.',
          ),
        );
      } else {
        reject(new Error(trimmed || `osascript exit ${code}`));
      }
    });
  });
}

const KEY_CODE_MAP: Record<string, number> = {
  enter: 36, return: 36, tab: 48, space: 49,
  delete: 51, backspace: 51, forwarddelete: 117,
  escape: 53, esc: 53,
  up: 126, down: 125, left: 123, right: 124,
  home: 115, end: 119, pageup: 116, pagedown: 121,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98,
  f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
};

function buildKeystrokeAppleScript(
  step: { type: 'text'; text: string } | { type: 'keys'; keys: string },
): string[] {
  if (step.type === 'text') {
    return [`tell application "System Events" to keystroke "${escapeAS(step.text)}"`];
  }
  const parts = step.keys.toLowerCase().split('+').map((s) => s.trim()).filter(Boolean);
  const modifiers: string[] = [];
  let key = '';
  for (const p of parts) {
    if (p === 'cmd' || p === 'command' || p === 'meta' || p === 'super') {
      modifiers.push('command down');
    } else if (p === 'shift') modifiers.push('shift down');
    else if (p === 'opt' || p === 'option' || p === 'alt') modifiers.push('option down');
    else if (p === 'ctrl' || p === 'control') modifiers.push('control down');
    else key = p;
  }
  if (!key) {
    throw new Error(`키 조합에 키가 없습니다: "${step.keys}"`);
  }
  const using = modifiers.length > 0 ? ` using {${modifiers.join(', ')}}` : '';
  const code = KEY_CODE_MAP[key];
  if (code !== undefined) {
    return [`tell application "System Events" to key code ${code}${using}`];
  }
  // Single character / multi-char keystroke. AppleScript types each char in
  // sequence with the modifiers applied to each.
  return [`tell application "System Events" to keystroke "${escapeAS(key)}"${using}`];
}

function formatDate(d: Date, fmt: string): string {
  if (!fmt) return d.toISOString();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const replacements: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
    ss: pad(d.getSeconds()),
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (m) => replacements[m] ?? m);
}

export function buildSuggestPrompt(userPrompt: string): string {
  return [
    '당신은 사용자가 원하는 매크로 버튼을 JSON 으로 정의해주는 도우미입니다.',
    '아래 사용자의 요청을 읽고, 그것을 실행할 수 있는 매크로 트리로 변환하세요.',
    '',
    '반드시 JSON 객체 하나만 한 줄로 출력하세요. 마크다운/코드펜스/설명 텍스트 금지.',
    '',
    '# 최상위 응답 스키마',
    '{ "drafts": TileDraft[] }   // 1개 이상. 현재 보드에 추가될 타일들.',
    '',
    '# TileDraft 는 다음 둘 중 하나의 union (재귀):',
    'ActionDraft = {',
    '  "kind": "action",',
    '  "label": string,                        // 짧고 명확한 한국어 레이블',
    '  "icon"?: string,                        // 이모지 1자 (권장)',
    '  "color"?: string,                       // 헥스. 권장 프리셋:',
    '                                          //   #3b82f6 #10b981 #f59e0b #ef4444 #8b5cf6 #ec4899 #06b6d4 #1f2937',
    '  "actions": Action[]                     // 1개 이상',
    '}',
    'GroupDraft = {',
    '  "kind": "group",                        // 폴더(서브보드)를 만들고 그 안에 children 배치',
    '  "label": string,',
    '  "icon"?: string,                        // 폴더용 이모지 (예: "📁","🛠","⚙️")',
    '  "color"?: string,                       // 보통 생략 — 폴더는 투명 배경이 자연스러움',
    '  "children": TileDraft[]                 // 그룹 안에 들어갈 매크로들 (액션/그룹 혼합, 재귀)',
    '}',
    '',
    '# 그룹 사용 기준',
    '- 사용자가 여러 개의 관련 매크로를 만들고 싶다고 하면 → 그룹으로 묶을 것.',
    '- 동작 카테고리가 분명히 다르면 (예: "git 작업" + "슬랙 메시지" + "디자인 도구") 각각 별도 그룹으로.',
    '- 매크로가 2~3개 이하이고 같은 맥락이면 그룹 없이 평면으로.',
    '',
    'Action 은 다음 7종 중 하나의 discriminated union:',
    '  { "kind": "shell",        "command": string, "continueOnError"?: boolean }',
    '  { "kind": "http",         "method": "GET"|"POST"|"PUT"|"PATCH"|"DELETE", "url": string, "headers"?: object, "body"?: string, "continueOnError"?: boolean }',
    '  { "kind": "delay",        "ms": number(0~60000) }',
    '  { "kind": "os.open",      "target": string, "continueOnError"?: boolean }  // URL 또는 절대 파일/앱(.app)/폴더 경로',
    '  { "kind": "os.clipboard", "text": string }',
    '  { "kind": "ai",           "prompt": string, "output": "clipboard"|"echo", "continueOnError"?: boolean }',
    '       // claude CLI 한 번 더 호출. output="clipboard"면 결과를 클립보드에 넣어 다음 액션에서 {{clipboard}}로 활용.',
    '  { "kind": "keystroke",    "app"?: string, "steps": KeystrokeStep[], "continueOnError"?: boolean }',
    '       // macOS 전용. app 지정 시 활성화 후 키 전송. KeystrokeStep:',
    '       //   { "type": "keys", "keys": "cmd+shift+t", "delayMs"?: number }',
    '       //   { "type": "text", "text": "hello", "delayMs"?: number }',
    '       //   { "type": "wait", "ms": number }',
    '       // 키 표기 예: "cmd+space", "enter", "tab", "up", "down", "left", "right", "f5".',
    '',
    '# 변수 토큰 (실행 시 자동 치환됨, 모든 string 필드에서 사용 가능)',
    '  {{clipboard}}           — 실행 직전 OS 클립보드 내용',
    '  {{date}}                — 현재 ISO 타임스탬프',
    '  {{date:YYYY-MM-DD}}     — 포맷된 날짜 (지원: YYYY MM DD HH mm ss)',
    '  {{prompt}}              — 실행 시 사용자에게 입력받음 (1개일 때)',
    '  {{prompt:라벨}}         — 라벨이 있는 입력 (예: {{prompt:이슈번호}})',
    '',
    '# 규칙',
    '- shell command 는 사용자의 OS shell 에서 실행됩니다. rm -rf, sudo 같은 위험 명령 금지.',
    '- 사용자는 macOS. AppleScript/keystroke 적극 활용 가능.',
    '- 정보가 부족하면 {{prompt:라벨}} 토큰으로 실행 시 입력받는 매크로를 우선합니다.',
    '- 요청을 완전히 충족할 수 없으면 가능한 부분만 액션으로 채우세요. 빈 actions 배열은 금지.',
    '',
    '# 사용자 요청',
    userPrompt.slice(0, 2000),
  ].join('\n');
}

export function parseSuggestResponse(raw: string): SuggestTileResponse {
  const trimmed = raw.trim();
  const fenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new ApiError(
      'INTERNAL',
      `AI 응답을 파싱할 수 없습니다: ${trimmed.slice(0, 160)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1));
  } catch (err) {
    throw new ApiError(
      'INTERNAL',
      `AI JSON 파싱 실패: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  // Backwards compat: if the model returned just an action draft (older
  // schema), wrap it. This keeps the parser tolerant while we transition.
  const candidate =
    parsed && typeof parsed === 'object' && 'drafts' in (parsed as object)
      ? parsed
      : { drafts: [parsed] };
  const result = aiSuggestResponseSchema.safeParse(candidate);
  if (!result.success) {
    throw new ApiError(
      'INTERNAL',
      `AI 응답 스키마 불일치: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')} ${i.message}`)
        .join('; ')}`,
    );
  }
  return { drafts: result.data.drafts };
}

/**
 * Remove boards that are no longer reachable from the root via group tiles.
 * Mutates `state.boards` in place.
 */
function gcOrphanBoards(state: MacroState): void {
  const reachable = new Set<string>();
  const queue: string[] = [state.rootBoardId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const board = state.boards.find((b) => b.id === id);
    if (!board) continue;
    for (const tile of board.tiles) {
      if (isGroupTile(tile)) queue.push(tile.groupBoardId);
    }
  }
  state.boards = state.boards.filter((b) => reachable.has(b.id));
}
