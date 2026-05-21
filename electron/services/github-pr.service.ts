import { ApiError } from '../infra/error';
import { normalizeApiUrl, parseRepos, type GitHubPrConfig } from '../domain/github-pr';
import type {
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
    return { token: token.trim(), apiUrl, repos };
  }
}
