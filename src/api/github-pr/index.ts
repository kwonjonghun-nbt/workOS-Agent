import type {
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
};

export type {
  GitHubPullRequest,
  GithubPrTestConnectionResponse,
  ListPullRequestsRequest,
  ListPullRequestsResponse,
  PrStateFilter,
} from './types';
