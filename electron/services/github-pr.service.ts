import { ApiError } from '../infra/error';
import {
  buildReleaseBody,
  formatKstStamp,
  normalizeApiUrl,
  parseRepos,
  parseReviewers,
  releaseBranchName,
  releaseTitle,
  tagUrl,
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
    const stamp = formatKstStamp(new Date());
    const branchName = releaseBranchName(stamp);

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

    const title = releaseTitle(stamp);
    const body = buildReleaseBody(compare.commits);

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
    const title = releaseTitle(tag);

    const tagObj = await this.repo.createAnnotatedTag(config, entry.owner, entry.repo, {
      tag,
      sha,
      message: title,
    });
    await this.repo.createTagRef(config, entry.owner, entry.repo, tag, tagObj.sha);

    return { tag, sha, tagUrl: tagUrl(config.apiUrl, entry.owner, entry.repo, tag) };
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
