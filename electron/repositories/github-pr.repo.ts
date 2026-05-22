import { net } from 'electron';
import { ApiError } from '../infra/error';
import {
  mapPullRequest,
  type GitHubPrConfig,
  type GithubListPullsItem,
} from '../domain/github-pr';
import type { GitHubPullRequest } from '../contracts/github-pr';

const LOG = (...args: unknown[]) => console.log('[github-pr.repo]', ...args);

export interface GitHubPrRepository {
  fetchPullRequests(
    config: GitHubPrConfig,
    state: 'open' | 'closed' | 'all',
  ): Promise<{
    prs: GitHubPullRequest[];
    errors: Array<{ repo: string; error: string }>;
    hasMore: boolean;
  }>;
  testConnection(config: GitHubPrConfig): Promise<{ login: string }>;
  getBranchSha(config: GitHubPrConfig, owner: string, repo: string, branch: string): Promise<string>;
  createBranch(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    branchName: string,
    sha: string,
  ): Promise<void>;
  compareCommits(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<{
    aheadBy: number;
    commits: Array<{ sha: string; message: string; author: string }>;
    files: Array<{ filename: string; additions: number; deletions: number }>;
  }>;
  createPullRequest(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    args: { title: string; head: string; base: string; body: string },
  ): Promise<{ number: number; htmlUrl: string }>;
  createAnnotatedTag(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    args: { tag: string; sha: string; message: string },
  ): Promise<{ sha: string }>;
  createTagRef(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    tag: string,
    sha: string,
  ): Promise<void>;
  createRelease(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    args: { tag: string; targetSha: string; name: string },
  ): Promise<{ htmlUrl: string }>;
  requestReviewers(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
  ): Promise<{ requested: string[] }>;
}

export class HttpGitHubPrRepository implements GitHubPrRepository {
  async fetchPullRequests(
    config: GitHubPrConfig,
    state: 'open' | 'closed' | 'all',
  ): Promise<{
    prs: GitHubPullRequest[];
    errors: Array<{ repo: string; error: string }>;
    hasMore: boolean;
  }> {
    const results = await Promise.allSettled(
      config.repos.map(({ owner, repo }) =>
        this.fetchPRsFromRepo(config, owner, repo, state),
      ),
    );

    const allPRs: GitHubPullRequest[] = [];
    const errors: Array<{ repo: string; error: string }> = [];
    let hasMore = false;

    results.forEach((result, i) => {
      const full = config.repos[i].full;
      if (result.status === 'fulfilled') {
        allPRs.push(...result.value.prs);
        if (result.value.hasMore) hasMore = true;
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        LOG('PR fetch failed for', full, ':', message);
        errors.push({ repo: full, error: message });
      }
    });

    // Defensive dedup keyed by `${repo}#${number}` in case the upstream config
    // somehow listed the same repo twice past parseRepos, or GitHub returned
    // the same PR on adjacent pages during a refresh race.
    const seen = new Set<string>();
    const deduped: GitHubPullRequest[] = [];
    for (const pr of allPRs) {
      const key = `${pr.repo.toLowerCase()}#${pr.number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(pr);
    }

    deduped.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return { prs: deduped, errors, hasMore };
  }

  async testConnection(config: GitHubPrConfig): Promise<{ login: string }> {
    const url = `${config.apiUrl}/user`;
    LOG('GET', url);
    const res = await net.fetch(url, { headers: this.buildHeaders(config.token) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      LOG('test error:', res.status, text.slice(0, 200));
      if (res.status === 401 || res.status === 403) {
        throw new ApiError(
          'VALIDATION',
          `GitHub 인증 실패 (${res.status}). 토큰 권한과 만료를 확인하세요.`,
        );
      }
      throw new ApiError('INTERNAL', `GitHub API 오류 ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { login?: string };
    return { login: String(data.login ?? '') };
  }

  private async fetchPRsFromRepo(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all',
  ): Promise<{ prs: GitHubPullRequest[]; hasMore: boolean }> {
    const full = `${owner}/${repo}`;
    const url = `${config.apiUrl}/repos/${owner}/${repo}/pulls?state=${state}&sort=updated&direction=desc&per_page=100`;
    LOG('GET', url);
    const res = await net.fetch(url, { headers: this.buildHeaders(config.token) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const linkHeader = res.headers.get('link') ?? '';
    const hasMore = linkHeader.includes('rel="next"');
    const data = (await res.json()) as GithubListPullsItem[];
    return { prs: data.map((item) => mapPullRequest(item, full)), hasMore };
  }

  async getBranchSha(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string> {
    const url = `${config.apiUrl}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`;
    const res = await net.fetch(url, { headers: this.buildHeaders(config.token) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 404) {
        throw new ApiError('VALIDATION', `'${branch}' 브랜치를 찾을 수 없습니다 (${owner}/${repo}).`);
      }
      throw new ApiError('INTERNAL', `브랜치 조회 실패 ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { object?: { sha?: string } };
    const sha = data.object?.sha;
    if (!sha) throw new ApiError('INTERNAL', '브랜치 SHA 응답이 비어 있습니다.');
    return sha;
  }

  async createBranch(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    branchName: string,
    sha: string,
  ): Promise<void> {
    const url = `${config.apiUrl}/repos/${owner}/${repo}/git/refs`;
    const res = await net.fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 422) {
        throw new ApiError('VALIDATION', `브랜치 '${branchName}' 가 이미 존재하거나 SHA가 유효하지 않습니다.`);
      }
      throw new ApiError('INTERNAL', `브랜치 생성 실패 ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  async compareCommits(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<{
    aheadBy: number;
    commits: Array<{ sha: string; message: string; author: string }>;
    files: Array<{ filename: string; additions: number; deletions: number }>;
  }> {
    const url = `${config.apiUrl}/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}?per_page=250`;
    const res = await net.fetch(url, { headers: this.buildHeaders(config.token) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError('INTERNAL', `브랜치 비교 실패 ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      ahead_by?: number;
      commits?: Array<{
        sha: string;
        commit: { message: string; author: { name?: string } };
      }>;
      files?: Array<{ filename: string; additions: number; deletions: number }>;
    };
    return {
      aheadBy: data.ahead_by ?? 0,
      commits: (data.commits ?? []).map((c) => ({
        sha: c.sha.slice(0, 7),
        message: (c.commit?.message ?? '').split('\n')[0],
        author: c.commit?.author?.name ?? '',
      })),
      files: (data.files ?? []).map((f) => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
      })),
    };
  }

  async createPullRequest(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    args: { title: string; head: string; base: string; body: string },
  ): Promise<{ number: number; htmlUrl: string }> {
    const url = `${config.apiUrl}/repos/${owner}/${repo}/pulls`;
    const res = await net.fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError('INTERNAL', `PR 생성 실패 ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as { number: number; html_url: string };
    return { number: data.number, htmlUrl: data.html_url };
  }

  async createAnnotatedTag(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    args: { tag: string; sha: string; message: string },
  ): Promise<{ sha: string }> {
    const url = `${config.apiUrl}/repos/${owner}/${repo}/git/tags`;
    const res = await net.fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag: args.tag,
        message: args.message,
        object: args.sha,
        type: 'commit',
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError('INTERNAL', `태그 객체 생성 실패 ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { sha: string };
    return { sha: data.sha };
  }

  async createTagRef(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    tag: string,
    sha: string,
  ): Promise<void> {
    const url = `${config.apiUrl}/repos/${owner}/${repo}/git/refs`;
    const res = await net.fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/tags/${tag}`, sha }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 422) {
        throw new ApiError('VALIDATION', `태그 '${tag}' 가 이미 존재합니다.`);
      }
      throw new ApiError('INTERNAL', `태그 ref 생성 실패 ${res.status}: ${text.slice(0, 200)}`);
    }
  }

  async createRelease(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    args: { tag: string; targetSha: string; name: string },
  ): Promise<{ htmlUrl: string }> {
    const url = `${config.apiUrl}/repos/${owner}/${repo}/releases`;
    const res = await net.fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tag_name: args.tag,
        target_commitish: args.targetSha,
        name: args.name,
        generate_release_notes: true,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError('INTERNAL', `릴리즈 생성 실패 ${res.status}: ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as { html_url: string };
    return { htmlUrl: data.html_url };
  }

  async requestReviewers(
    config: GitHubPrConfig,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
  ): Promise<{ requested: string[] }> {
    const url = `${config.apiUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/requested_reviewers`;
    const res = await net.fetch(url, {
      method: 'POST',
      headers: { ...this.buildHeaders(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewers }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError('INTERNAL', `리뷰어 지정 실패 ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as { requested_reviewers?: Array<{ login: string }> };
    return { requested: (data.requested_reviewers ?? []).map((r) => r.login) };
  }

  private buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'workOS-Agent',
    };
  }
}
