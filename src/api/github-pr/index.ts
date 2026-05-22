import type {
  CreateReleaseBranchRequest,
  CreateReleaseBranchResponse,
  CreateReleaseTagRequest,
  CreateReleaseTagResponse,
  GithubPrListReposResponse,
  GithubPrTestConnectionResponse,
  ListPullRequestsRequest,
  ListPullRequestsResponse,
} from './types';

function api() {
  return window.electronAPI.githubPr;
}

export const githubPrApi = {
  listPullRequests: (req: ListPullRequestsRequest = {}): Promise<ListPullRequestsResponse> =>
    api().listPullRequests({ state: req.state ?? 'open' }),
  testConnection: (): Promise<GithubPrTestConnectionResponse> => api().testConnection(),
  listRepos: (): Promise<GithubPrListReposResponse> => api().listRepos(),
  createReleaseBranch: (req: CreateReleaseBranchRequest): Promise<CreateReleaseBranchResponse> =>
    api().createReleaseBranch(req),
  createReleaseTag: (req: CreateReleaseTagRequest): Promise<CreateReleaseTagResponse> =>
    api().createReleaseTag(req),
};

export type {
  CreateReleaseBranchRequest,
  CreateReleaseBranchResponse,
  CreateReleaseTagRequest,
  CreateReleaseTagResponse,
  GitHubPullRequest,
  GithubPrListReposResponse,
  GithubPrTestConnectionResponse,
  ListPullRequestsRequest,
  ListPullRequestsResponse,
  PrStateFilter,
} from './types';
