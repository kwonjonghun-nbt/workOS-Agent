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
