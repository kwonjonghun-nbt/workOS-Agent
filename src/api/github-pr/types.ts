// Type-only mirrors of electron/contracts/github-pr.ts.

export type GitHubPullRequest = {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged: boolean;
  user: { login: string; avatarUrl: string };
  repo: string;
  headRef: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  labels: Array<{ name: string; color: string }>;
  requestedReviewers: Array<{ login: string }>;
};

export type PrStateFilter = 'open' | 'closed' | 'all';

export type ListPullRequestsRequest = { state?: PrStateFilter };

export type ListPullRequestsResponse = {
  prs: GitHubPullRequest[];
  errors: Array<{ repo: string; error: string }>;
  hasMore: boolean;
};

export type GithubPrTestConnectionResponse = {
  ok: true;
  login: string;
  apiUrl: string;
  repos: string[];
};
