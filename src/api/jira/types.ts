// Type-only mirrors of electron/contracts/jira.ts.

export type JiraIssue = {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string | null;
  issueType: string;
  assignee: string | null;
  reporter: string | null;
  created: string;
  updated: string;
  url: string;
};

export type ListMyIssuesRequest = { maxResults?: number };

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

export type GetIssueDetailRequest = { issueKey: string };

export type GetIssueDetailResponse = {
  key: string;
  summary: string;
  issueType: string;
  parentKey: string | null;
  descriptionMarkdown: string;
};
