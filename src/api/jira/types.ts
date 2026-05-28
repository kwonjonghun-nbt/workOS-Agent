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

// ----- Workflow ↔ Jira integration ----------------------------------------

export type CreateIssueRequest = {
  summary: string;
  issueType: string;
  parentKey?: string;
  description?: string;
  projectKey?: string;
};

export type CreateIssueResponse = {
  key: string;
  url: string;
  issueType: string;
};

export type ListIssueChildrenRequest = { parentKey: string };

export type JiraChildIssue = {
  key: string;
  summary: string;
  issueType: string;
  status: string;
};

export type ListIssueChildrenResponse = {
  parent: JiraChildIssue;
  children: JiraChildIssue[];
};

export type GetTransitionsRequest = { issueKey: string };

export type JiraTransition = {
  id: string;
  name: string;
  to: string;
};

export type GetTransitionsResponse = {
  transitions: JiraTransition[];
};

export type TransitionIssueRequest = {
  issueKey: string;
  transitionId?: string;
  transitionName?: string;
};

export type TransitionIssueResponse = {
  ok: true;
  toStatus: string;
};
