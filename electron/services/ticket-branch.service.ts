import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ApiError } from '../infra/error';
import type { LlmCliRepository } from '../repositories/llm-cli.repo';
import {
  branchSkipReason,
  buildFeatureBranchName,
  slugifyEnglish,
} from '../domain/branch-name';
import type {
  CreateTicketBranchRequest,
  CreateTicketBranchResponse,
} from '../contracts/branch';

const execFileP = promisify(execFile);
const LOG = (...a: unknown[]) => console.log('[ticket-branch]', ...a);

/** workOS.service 와 동일한 cwd 해석 계약. */
export type CwdResolver = { resolveCwd(workspaceId: string): Promise<string> };

const TRANSLATE_TIMEOUT_MS = 60_000;

/**
 * 새 Jira 티켓을 위한 feature 브랜치를 만든다.
 *
 * use-case: 요약을 영문 slug 로 번역(claude CLI) → `feature/{key}_{slug}` 네이밍 →
 * `origin/develop` 최신 기준으로 생성·체크아웃. Epic/Bug 는 건너뛴다.
 *
 * - 번역 실패/빈 결과 → 요약 없이 `feature/{key}` 로 폴백(비치명적).
 * - git 작업 실패(저장소 아님 · 작업트리 더러움 · fetch 실패 · 동명 브랜치) → ApiError throw.
 *   호출 측(렌더러)은 이를 받아 세션 게이트를 resolve 하지 않고 차단한다.
 */
export class TicketBranchService {
  constructor(
    private readonly llm: LlmCliRepository,
    private readonly cwd: CwdResolver,
  ) {}

  async createForTicket(req: CreateTicketBranchRequest): Promise<CreateTicketBranchResponse> {
    const summary = req.summary ?? '';
    const issueTypeName = req.issueTypeName ?? '';
    const baseBranch = req.baseBranch ?? 'origin/develop';

    const skip = branchSkipReason(issueTypeName);
    if (skip) {
      LOG('skip branch for type', `"${issueTypeName}"`, '→', skip);
      return { created: false, branchName: null, skippedReason: skip };
    }

    const slug = await this.translateSlug(summary);
    const branchName = buildFeatureBranchName(req.ticketKey, slug);

    const cwd = await this.cwd.resolveCwd(req.workspaceId);
    await this.createBranch(cwd, branchName, baseBranch);

    return { created: true, branchName, skippedReason: null };
  }

  /** 요약 → 영문 slug. 실패/빈 결과면 null(요약 없는 브랜치명으로 폴백). */
  private async translateSlug(summary: string): Promise<string | null> {
    const trimmed = summary.trim();
    if (!trimmed) return null;
    try {
      const prompt = [
        'Convert the following Jira ticket summary into a short English git branch slug.',
        'Rules: lowercase ASCII letters and numbers only, words separated by single underscores,',
        'at most 6 words, no leading/trailing punctuation.',
        'Output ONLY the slug on a single line — no quotes, no explanation, no code fences.',
        '',
        `Summary: ${trimmed}`,
      ].join('\n');
      const raw = await this.llm.runText(prompt, {
        model: 'haiku',
        timeoutMs: TRANSLATE_TIMEOUT_MS,
      });
      const firstLine = raw
        .split('\n')
        .map((l) => l.trim())
        .find(Boolean);
      const slug = slugifyEnglish(firstLine ?? '');
      return slug || null;
    } catch (err) {
      LOG('translate failed, fallback to key-only:', (err as Error).message);
      return null;
    }
  }

  /** origin/develop 최신을 받아 feature 브랜치를 만들고 체크아웃. 실패 시 ApiError(세션 차단). */
  private async createBranch(cwd: string, branchName: string, baseBranch: string): Promise<void> {
    // 1) git 저장소인지
    try {
      await execFileP('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
    } catch {
      throw new ApiError('VALIDATION', `git 저장소가 아닙니다: ${cwd}`);
    }
    // 2) 작업트리 청결 확인 — 더러우면 분기/전환이 위험하므로 차단
    const { stdout: status } = await execFileP('git', ['status', '--porcelain'], {
      cwd,
      maxBuffer: 8 * 1024 * 1024,
    });
    if (status.trim()) {
      throw new ApiError(
        'VALIDATION',
        '작업트리에 커밋되지 않은 변경이 있어 브랜치를 만들 수 없습니다. 먼저 정리(commit/stash)해주세요.',
      );
    }
    // 3) 기준 브랜치 최신화(origin/develop)
    try {
      await execFileP('git', ['fetch', 'origin', 'develop'], { cwd });
    } catch (err) {
      throw new ApiError('INTERNAL', `origin/develop fetch 실패: ${(err as Error).message}`);
    }
    // 4) 동명 브랜치 존재 검사
    if (await branchExists(cwd, branchName)) {
      throw new ApiError('VALIDATION', `이미 존재하는 브랜치입니다: ${branchName}`);
    }
    // 5) 생성 + 체크아웃
    try {
      await execFileP('git', ['checkout', '-b', branchName, baseBranch], { cwd });
      LOG('created + checked out', branchName, 'from', baseBranch);
    } catch (err) {
      throw new ApiError('INTERNAL', `브랜치 생성 실패(${branchName}): ${(err as Error).message}`);
    }
  }
}

/** 로컬 브랜치 존재 여부. `rev-parse --verify` 는 없으면 비0 종료 → false. */
async function branchExists(cwd: string, branchName: string): Promise<boolean> {
  try {
    await execFileP('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}`], {
      cwd,
    });
    return true;
  } catch {
    return false;
  }
}
