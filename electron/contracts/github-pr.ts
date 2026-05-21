import { z } from 'zod';

export const githubPullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  draft: z.boolean(),
  merged: z.boolean(),
  user: z.object({ login: z.string(), avatarUrl: z.string() }),
  repo: z.string(),
  headRef: z.string(),
  htmlUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  labels: z.array(z.object({ name: z.string(), color: z.string() })),
  requestedReviewers: z.array(z.object({ login: z.string() })),
});
export type GitHubPullRequest = z.infer<typeof githubPullRequestSchema>;

export const listPullRequestsRequestSchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
});
export type ListPullRequestsRequest = z.infer<typeof listPullRequestsRequestSchema>;

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
