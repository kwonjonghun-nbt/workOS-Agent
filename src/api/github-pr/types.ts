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

export type GithubPrListReposResponse = { repos: string[] };

export type CreateReleaseBranchRequest = {
  repo: string;
  baseBranch?: string;
  targetBranch?: string;
};

export type CreateReleaseBranchResponse = {
  branch: string;
  prNumber: number;
  prUrl: string;
  commitCount: number;
  requestedReviewers: string[];
  reviewerWarning: string | null;
};

export type CreateReleaseTagRequest = {
  repo: string;
  branch?: string;
};

export type CreateReleaseTagResponse = {
  tag: string;
  sha: string;
  releaseUrl: string;
};
