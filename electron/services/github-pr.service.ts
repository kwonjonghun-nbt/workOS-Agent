import { ApiError } from '../infra/error';
import {
  normalizeApiUrl,
  parseRepos,
  parseReviewers,
  type GitHubPrConfig,
} from '../domain/github-pr';
import type {
  CreateReleaseBranchRequest,
  CreateReleaseBranchResponse,
  CreateReleaseTagRequest,
  CreateReleaseTagResponse,
  GithubPrListReposResponse,
  GithubPrTestConnectionResponse,
  ListPullRequestsResponse,
} from '../contracts/github-pr';
import type { GitHubPrRepository } from '../repositories/github-pr.repo';
import type { ExtensionService } from './extension.service';

const LOG = (...args: unknown[]) => console.log('[github-pr.service]', ...args);

const GITHUB_PR_EXTENSION_ID = 'workos.github-pr';

export class GitHubPrService {
  constructor(
    private readonly repo: GitHubPrRepository,
    private readonly extensionService: ExtensionService,
  ) {}

  async listPullRequests(
    state: 'open' | 'closed' | 'all',
  ): Promise<ListPullRequestsResponse> {
    const config = await this.loadConfig();
    LOG('listPullRequests state=', state, 'repos=', config.repos.map((r) => r.full));
    const result = await this.repo.fetchPullRequests(config, state);
    LOG('listPullRequests result:', result.prs.length, 'prs, errors=', result.errors.length);
    return result;
  }

  async testConnection(): Promise<GithubPrTestConnectionResponse> {
    const config = await this.loadConfig();
    LOG('testConnection apiUrl=', config.apiUrl);
    const { login } = await this.repo.testConnection(config);
    return {
      ok: true,
      login,
      apiUrl: config.apiUrl,
      repos: config.repos.map((r) => r.full),
    };
  }

  async listRepos(): Promise<GithubPrListReposResponse> {
    const config = await this.loadConfig();
    return { repos: config.repos.map((r) => r.full) };
  }

  async createReleaseBranch(
    req: CreateReleaseBranchRequest,
  ): Promise<CreateReleaseBranchResponse> {
    const config = await this.loadConfig();
    const entry = this.findRepo(config, req.repo);
    const baseBranch = req.baseBranch || 'develop';
    const targetBranch = req.targetBranch || 'main';

    LOG('createReleaseBranch repo=', entry.full, 'base=', baseBranch, '→', targetBranch);

    const sha = await this.repo.getBranchSha(config, entry.owner, entry.repo, baseBranch);
    const branchName = `release/${formatKstStamp(new Date())}`;

    const compare = await this.repo.compareCommits(
      config,
      entry.owner,
      entry.repo,
      targetBranch,
      baseBranch,
    );
    if (compare.aheadBy === 0) {
      throw new ApiError(
        'VALIDATION',
        `'${baseBranch}' 가 '${targetBranch}' 와 동일합니다. 릴리즈할 커밋이 없습니다.`,
      );
    }

    await this.repo.createBranch(config, entry.owner, entry.repo, branchName, sha);

    const title = buildReleaseTitle(branchName, compare.commits);
    const body = buildReleaseBody(branchName, baseBranch, targetBranch, compare);

    const pr = await this.repo.createPullRequest(config, entry.owner, entry.repo, {
      title,
      head: branchName,
      base: targetBranch,
      body,
    });

    let requestedReviewers: string[] = [];
    let reviewerWarning: string | null = null;
    if (config.releaseReviewers.length > 0) {
      try {
        const r = await this.repo.requestReviewers(
          config,
          entry.owner,
          entry.repo,
          pr.number,
          config.releaseReviewers,
        );
        requestedReviewers = r.requested;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        LOG('reviewer request failed:', message);
        reviewerWarning = message;
      }
    }

    return {
      branch: branchName,
      prNumber: pr.number,
      prUrl: pr.htmlUrl,
      commitCount: compare.commits.length,
      requestedReviewers,
      reviewerWarning,
    };
  }

  async createReleaseTag(
    req: CreateReleaseTagRequest,
  ): Promise<CreateReleaseTagResponse> {
    const config = await this.loadConfig();
    const entry = this.findRepo(config, req.repo);
    const branch = req.branch || 'main';

    LOG('createReleaseTag repo=', entry.full, 'branch=', branch);

    const sha = await this.repo.getBranchSha(config, entry.owner, entry.repo, branch);
    const tag = formatKstStamp(new Date());
    const title = `Release ${tag}`;

    const tagObj = await this.repo.createAnnotatedTag(config, entry.owner, entry.repo, {
      tag,
      sha,
      message: title,
    });
    await this.repo.createTagRef(config, entry.owner, entry.repo, tag, tagObj.sha);
    const release = await this.repo.createRelease(config, entry.owner, entry.repo, {
      tag,
      targetSha: sha,
      name: title,
    });

    return { tag, sha, releaseUrl: release.htmlUrl };
  }

  private findRepo(config: GitHubPrConfig, repoFull: string) {
    const normalized = repoFull.trim().toLowerCase();
    const entry = config.repos.find((r) => r.full.toLowerCase() === normalized);
    if (!entry) {
      throw new ApiError('VALIDATION', `등록되지 않은 레포입니다: ${repoFull}`);
    }
    return entry;
  }

  private async loadConfig(): Promise<GitHubPrConfig> {
    const enabled = await this.extensionService.isEnabled(GITHUB_PR_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'GitHub PR 확장이 비활성화되어 있습니다. Extensions 패널에서 활성화하세요.',
      );
    }
    const settings = await this.extensionService.getSettings(GITHUB_PR_EXTENSION_ID);
    const token = settings.token;
    const reposRaw = settings.repos;
    const apiUrlRaw = settings.apiUrl;

    if (typeof token !== 'string' || token.trim() === '') {
      throw new ApiError('VALIDATION', 'GitHub 토큰이 설정되지 않았습니다.');
    }
    if (typeof reposRaw !== 'string' || reposRaw.trim() === '') {
      throw new ApiError('VALIDATION', '레포 목록이 설정되지 않았습니다. (예: owner/repo)');
    }
    const repos = parseRepos(reposRaw);
    if (repos.length === 0) {
      throw new ApiError('VALIDATION', '유효한 레포가 없습니다. owner/repo 형식으로 입력하세요.');
    }
    const apiUrl = normalizeApiUrl(typeof apiUrlRaw === 'string' ? apiUrlRaw : '');
    const reviewersRaw = settings.releaseReviewers;
    const releaseReviewers = parseReviewers(
      typeof reviewersRaw === 'string' ? reviewersRaw : '',
    );
    return { token: token.trim(), apiUrl, repos, releaseReviewers };
  }
}

function formatKstStamp(date: Date): string {
  // Render `YYYYMMDD_HHmm` in Asia/Seoul without external deps.
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

function buildReleaseTitle(
  branch: string,
  commits: Array<{ message: string }>,
): string {
  const stamp = branch.replace(/^release\//, '');
  const display = stamp.replace(
    /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})$/,
    '$1-$2-$3 $4:$5',
  );
  const summaries = commits
    .map((c) => stripCommitPrefix(c.message))
    .filter(Boolean)
    .slice(0, 3);
  const tail = summaries.length > 0 ? summaries.join(' · ') : '배포';
  let title = `release(${display}): ${tail}`;
  if (title.length > 100) title = title.slice(0, 97) + '...';
  return title;
}

function stripCommitPrefix(message: string): string {
  // Drop merge commits and conventional-commit prefixes for the summary line.
  if (/^Merge (pull request|branch)/i.test(message)) return '';
  const m = message.match(
    /^(?:[A-Z]+-\d+\s+)?(?:feat|fix|chore|refactor|docs|test|perf|build|ci|style)(?:\([^)]+\))?:\s*(.+)$/i,
  );
  return (m ? m[1] : message).trim();
}

function buildReleaseBody(
  branch: string,
  base: string,
  target: string,
  compare: {
    commits: Array<{ sha: string; message: string; author: string }>;
    files: Array<{ filename: string; additions: number; deletions: number }>;
  },
): string {
  const jiraGroups = new Map<string, string[]>();
  const others: string[] = [];
  for (const c of compare.commits) {
    const msg = c.message;
    if (/^Merge (pull request|branch)/i.test(msg)) continue;
    const jiraMatch = msg.match(/^([A-Z]+-\d+)\b/);
    if (jiraMatch) {
      const key = jiraMatch[1];
      const list = jiraGroups.get(key) ?? [];
      list.push(stripCommitPrefix(msg) || msg);
      jiraGroups.set(key, list);
    } else {
      const stripped = stripCommitPrefix(msg);
      if (stripped) others.push(stripped);
    }
  }

  const changesSection: string[] = [];
  for (const [jira, msgs] of jiraGroups) {
    changesSection.push(`- **${jira}**`);
    for (const m of msgs) changesSection.push(`  - ${m}`);
  }
  for (const m of others) changesSection.push(`- ${m}`);
  if (changesSection.length === 0) changesSection.push('- (작업 커밋 없음)');

  const topDirs = summarizeTopDirs(compare.files);
  const impactSection =
    topDirs.length > 0
      ? topDirs.map((d) => `- \`${d.dir}\` (${d.count}개 파일, +${d.add}/-${d.del})`).join('\n')
      : '- 변경 영향 영역을 자동 추정할 수 없습니다. 확인 필요.';

  const commitLines = compare.commits
    .map((c) => `- ${c.sha} ${c.message}${c.author ? ` (${c.author})` : ''}`)
    .join('\n');

  return [
    `> ${base} → ${target} 릴리즈 (${branch})`,
    '',
    '## 주요 변경 기능',
    '',
    changesSection.join('\n'),
    '',
    '## 영향 화면 / 사이드이펙트',
    '',
    impactSection,
    '',
    '## 검증 방법',
    '',
    '- [ ] 주요 변경 기능별 수동 QA',
    '- [ ] 회귀 위험이 있는 공통 모듈 확인',
    '',
    '## 포함 커밋',
    '',
    commitLines || '- (없음)',
  ].join('\n');
}

function summarizeTopDirs(
  files: Array<{ filename: string; additions: number; deletions: number }>,
): Array<{ dir: string; count: number; add: number; del: number }> {
  const map = new Map<string, { count: number; add: number; del: number }>();
  for (const f of files) {
    const parts = f.filename.split('/');
    const dir = parts.length > 1 ? parts.slice(0, 2).join('/') : parts[0];
    const e = map.get(dir) ?? { count: 0, add: 0, del: 0 };
    e.count += 1;
    e.add += f.additions;
    e.del += f.deletions;
    map.set(dir, e);
  }
  return Array.from(map.entries())
    .map(([dir, v]) => ({ dir, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}
