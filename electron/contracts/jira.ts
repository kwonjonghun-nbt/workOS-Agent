import { z } from 'zod';

/**
 * Jira issue (subset) returned to the renderer. We narrow Atlassian's REST
 * payload to a small projection — enough to render a list with basic metrics.
 */
export const jiraIssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  summary: z.string(),
  status: z.string(),
  statusCategory: z.string(),
  priority: z.string().nullable(),
  issueType: z.string(),
  assignee: z.string().nullable(),
  reporter: z.string().nullable(),
  created: z.string(),
  updated: z.string(),
  url: z.string(),
});
export type JiraIssue = z.infer<typeof jiraIssueSchema>;

export const listMyIssuesRequestSchema = z.object({
  // Pagination — kept simple; UI fetches first page only for v1.
  maxResults: z.number().int().min(1).max(100).default(50),
});
export type ListMyIssuesRequest = z.infer<typeof listMyIssuesRequestSchema>;

export type ListMyIssuesResponse = {
  issues: JiraIssue[];
  total: number;
};

export type TestConnectionResponse = {
  ok: true;
  accountId: string;
  displayName: string;
  emailAddress: string | null;
  baseUrl: string;
  projectKeys: string[];
  matchedIssues: number;
};

export const getIssueDetailRequestSchema = z.object({
  issueKey: z.string().min(1),
});
export type GetIssueDetailRequest = z.infer<typeof getIssueDetailRequestSchema>;

export type GetIssueDetailResponse = {
  key: string;
  summary: string;
  issueType: string;
  parentKey: string | null;
  /** ADF → 마크다운으로 변환된 본문. */
  descriptionMarkdown: string;
};

// ----- Workflow ↔ Jira integration ----------------------------------------

export const createIssueRequestSchema = z.object({
  summary: z.string().min(1),
  issueType: z.string().min(1),
  parentKey: z.string().optional(),
  description: z.string().optional(),
  projectKey: z.string().optional(),
});
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;

export const createIssueResponseSchema = z.object({
  key: z.string(),
  url: z.string(),
  issueType: z.string(),
});
export type CreateIssueResponse = z.infer<typeof createIssueResponseSchema>;

export const listIssueChildrenRequestSchema = z.object({
  parentKey: z.string().min(1),
});
export type ListIssueChildrenRequest = z.infer<typeof listIssueChildrenRequestSchema>;

export const jiraChildIssueSchema = z.object({
  key: z.string(),
  summary: z.string(),
  issueType: z.string(),
  status: z.string(),
});
export type JiraChildIssue = z.infer<typeof jiraChildIssueSchema>;

export const listIssueChildrenResponseSchema = z.object({
  parent: jiraChildIssueSchema,
  children: z.array(jiraChildIssueSchema),
});
export type ListIssueChildrenResponse = z.infer<typeof listIssueChildrenResponseSchema>;

export const getTransitionsRequestSchema = z.object({
  issueKey: z.string().min(1),
});
export type GetTransitionsRequest = z.infer<typeof getTransitionsRequestSchema>;

export const jiraTransitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  to: z.string(),
});
export type JiraTransition = z.infer<typeof jiraTransitionSchema>;

export const getTransitionsResponseSchema = z.object({
  transitions: z.array(jiraTransitionSchema),
});
export type GetTransitionsResponse = z.infer<typeof getTransitionsResponseSchema>;

export const transitionIssueRequestSchema = z
  .object({
    issueKey: z.string().min(1),
    transitionId: z.string().min(1).optional(),
    transitionName: z.string().min(1).optional(),
  })
  .refine((v) => !!(v.transitionId || v.transitionName), {
    message: 'transitionId 또는 transitionName 중 하나는 필수입니다.',
  });
export type TransitionIssueRequest = z.infer<typeof transitionIssueRequestSchema>;

export const transitionIssueResponseSchema = z.object({
  ok: z.literal(true),
  toStatus: z.string(),
});
export type TransitionIssueResponse = z.infer<typeof transitionIssueResponseSchema>;
