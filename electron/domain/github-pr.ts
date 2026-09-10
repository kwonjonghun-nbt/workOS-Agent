import type { GitHubPullRequest } from '../contracts/github-pr';

export type GitHubPrConfig = {
  token: string;
  apiUrl: string;
  repos: Array<{ owner: string; repo: string; full: string }>;
  releaseReviewers: string[];
};

export function parseReviewers(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw.split(/[,\s]+/)) {
    const trimmed = entry.trim().replace(/^@/, '');
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Parse "owner/repo, owner2/repo2" into structured entries. Ignores blanks and
 * malformed segments (does not throw — the service layer reports the count
 * upstream so the user knows whether parsing dropped anything).
 */
export function parseRepos(raw: string): Array<{ owner: string; repo: string; full: string }> {
  const parsed = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = entry.match(/^([\w.-]+)\/([\w.-]+)$/);
      if (!m) return null;
      return { owner: m[1], repo: m[2], full: `${m[1]}/${m[2]}` };
    })
    .filter((v): v is { owner: string; repo: string; full: string } => v !== null);
  // GitHub repo names are case-insensitive, so fold duplicates that only
  // differ in casing (e.g. "Vercel/Next.js" vs "vercel/next.js") and exact
  // repeats from the user pasting the same entry twice.
  const seen = new Set<string>();
  const out: Array<{ owner: string; repo: string; full: string }> = [];
  for (const entry of parsed) {
    const key = entry.full.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

export function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed || 'https://api.github.com';
}

/**
 * API 주소에서 사람이 여는 웹 주소를 뽑는다.
 *   https://api.github.com      → https://github.com
 *   https://ghe.example.com/api/v3 → https://ghe.example.com
 */
export function htmlBaseFromApiUrl(apiUrl: string): string {
  const trimmed = apiUrl.replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'api.github.com') return 'https://github.com';
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://github.com';
  }
}

export function tagUrl(apiUrl: string, owner: string, repo: string, tag: string): string {
  return `${htmlBaseFromApiUrl(apiUrl)}/${owner}/${repo}/releases/tag/${encodeURIComponent(tag)}`;
}

// Raw shape returned by GitHub's `GET /repos/:owner/:repo/pulls`.
export type GithubListPullsItem = {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged_at: string | null;
  user: { login: string; avatar_url: string };
  head: { ref: string };
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string; color: string }>;
  requested_reviewers: Array<{ login: string }>;
};

// --- 릴리즈 네이밍 / 릴리즈 노트 -------------------------------------------
// adison-new-ads-web 의 실제 릴리즈 관례를 그대로 따른다.
//   릴리즈 브랜치: release/YYYYMMDD_HHmm (KST)
//   릴리즈 PR 제목: Release YYYYMMDD_HHmm
//   릴리즈 PR 본문: "## 수정사항" + 포함된 PR 번호 목록 (`- #123`)
//   태그: YYYYMMDD_HHmm, 태그 메시지: Release YYYYMMDD_HHmm
// 태그만 찍고 GitHub Release 는 만들지 않는다 (팀 레포도 Release 를 쓰지 않는다).

/** `YYYYMMDD_HHmm` (Asia/Seoul). 릴리즈 브랜치명·태그명·PR 제목이 모두 이걸 쓴다. */
export function formatKstStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const p of parts) lookup[p.type] = p.value;
  const hour = lookup.hour === '24' ? '00' : lookup.hour;
  return `${lookup.year}${lookup.month}${lookup.day}_${hour}${lookup.minute}`;
}

export function releaseBranchName(stamp: string): string {
  return `release/${stamp}`;
}

/** 릴리즈 PR 제목과 태그 메시지에 공통으로 쓰는 한 줄. */
export function releaseTitle(stamp: string): string {
  return `Release ${stamp}`;
}

// 머지 커밋: "Merge pull request #472 from nbtpartners/feature/AO-1234_foo"
const MERGE_PR_RE = /^Merge pull request #(\d+) from [^/\s]+\/(\S+)/i;
// 스쿼시 커밋: "AO-5970 : 무언가 (#469)"
const SQUASH_PR_RE = /\(#(\d+)\)\s*$/;
// main → develop 백머지처럼 릴리즈 내용이 아닌 PR 은 목록에서 뺀다.
const NON_RELEASE_BRANCH_RE = /^(main|master|backmerge\/|release\/)/i;
// 직전 릴리즈·백머지 지점. compare 결과에는 백머지 머지 토폴로지 때문에 이미
// 배포된 커밋까지 딸려오므로, 마지막 경계 뒤에 붙은 것만 이번 릴리즈로 본다.
const RELEASE_MARKER_RE = /^(Release \d{8}_\d{4}|Merge branch 'develop' into main)/i;
const REVERT_PR_RE = /^Revert\b.*#(\d+)/i;

function subjectOf(message: string): string {
  return message.split('\n')[0].trim();
}

function isReleaseMarker(subject: string): boolean {
  if (RELEASE_MARKER_RE.test(subject)) return true;
  const merge = subject.match(MERGE_PR_RE);
  return merge !== null && NON_RELEASE_BRANCH_RE.test(merge[2]);
}

/**
 * 직전 릴리즈/백머지 경계 뒤에 쌓인 커밋만 남긴다. 경계가 없으면 전체.
 */
export function commitsSinceLastRelease<T extends { message: string }>(commits: T[]): T[] {
  let cut = -1;
  commits.forEach((c, i) => {
    if (isReleaseMarker(subjectOf(c.message))) cut = i;
  });
  return commits.slice(cut + 1);
}

/**
 * 커밋 목록에서 이번 릴리즈에 포함된 PR 번호를 뽑는다. 시간순(오래된 것 먼저)
 * 을 유지하고 중복은 접는다. revert 된 PR 은 빼고, 백머지 PR 은 애초에 제외.
 */
export function collectReleasePrNumbers(commits: Array<{ message: string }>): number[] {
  const seen = new Set<number>();
  const reverted = new Set<number>();
  const out: number[] = [];
  for (const c of commits) {
    const subject = subjectOf(c.message);
    const revert = subject.match(REVERT_PR_RE);
    if (revert) {
      reverted.add(Number(revert[1]));
      continue;
    }
    const merge = subject.match(MERGE_PR_RE);
    let num: number | null = null;
    if (merge) {
      if (NON_RELEASE_BRANCH_RE.test(merge[2])) continue;
      num = Number(merge[1]);
    } else {
      const squash = subject.match(SQUASH_PR_RE);
      if (squash) num = Number(squash[1]);
    }
    if (num === null || seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }
  return out.filter((n) => !reverted.has(n));
}

/** conventional-commit / Jira prefix 를 떼어낸 커밋 제목. 머지 커밋은 빈 문자열. */
export function stripCommitPrefix(message: string): string {
  const subject = message.split('\n')[0].trim();
  if (/^Merge (pull request|branch|remote-tracking)/i.test(subject)) return '';
  const m = subject.match(
    /^(?:[A-Z]+-\d+\s+)?(?:feat|fix|chore|refactor|docs|test|perf|build|ci|style)(?:\([^)]+\))?:\s*(.+)$/i,
  );
  return (m ? m[1] : subject).trim();
}

/**
 * 릴리즈 PR 본문. PR 번호를 하나라도 찾으면 번호만 나열하고(팀 표준),
 * 하나도 못 찾으면 커밋 제목으로 대체한다.
 */
export function buildReleaseBody(commits: Array<{ message: string }>): string {
  const scoped = commitsSinceLastRelease(commits);
  const prNumbers = collectReleasePrNumbers(scoped);
  const lines =
    prNumbers.length > 0
      ? prNumbers.map((n) => `- #${n}`)
      : scoped
          .map((c) => stripCommitPrefix(c.message))
          .filter(Boolean)
          .map((s) => `- ${s}`);
  return ['## 수정사항', '', ...(lines.length > 0 ? lines : ['- (없음)']), ''].join('\n');
}

export function mapPullRequest(
  raw: GithubListPullsItem,
  repoFullName: string,
): GitHubPullRequest {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    draft: raw.draft,
    merged: raw.merged_at !== null,
    user: { login: raw.user.login, avatarUrl: raw.user.avatar_url },
    repo: repoFullName,
    headRef: raw.head.ref,
    htmlUrl: raw.html_url,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    labels: raw.labels.map((l) => ({ name: l.name, color: l.color })),
    requestedReviewers: raw.requested_reviewers.map((r) => ({ login: r.login })),
  };
}
