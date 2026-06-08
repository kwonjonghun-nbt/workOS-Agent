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

export type ListIssueTypesRequest = { projectKey?: string };

export type JiraIssueType = {
  id: string;
  name: string;
  subtask: boolean;
  hierarchyLevel: number | null;
};

export type ListIssueTypesResponse = {
  projectKey: string;
  issueTypes: JiraIssueType[];
};

export type CreateIssueRequest = {
  projectKey: string;
  issueTypeId: string;
  summary: string;
  descriptionMarkdown?: string;
  parentKey?: string;
};

export type CreateIssueResponse = {
  key: string;
  url: string;
};

export type ListEpicsRequest = { projectKey?: string };

export type JiraEpic = {
  key: string;
  summary: string;
};

export type ListEpicsResponse = {
  projectKey: string;
  epics: JiraEpic[];
};

export type SearchIssuesRequest = { text: string; maxResults?: number };

export type JiraProject = {
  key: string;
  name: string;
};

export type ListProjectsResponse = {
  projects: JiraProject[];
};
