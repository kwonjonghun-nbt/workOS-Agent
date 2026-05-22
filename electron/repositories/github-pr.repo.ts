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

  private buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'workOS-Agent',
    };
  }
}
