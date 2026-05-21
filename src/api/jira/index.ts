import type {
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  TestConnectionResponse,
} from './types';

function api() {
  return window.electronAPI.jira;
}

export const jiraApi = {
  listMyIssues: (req: ListMyIssuesRequest = {}): Promise<ListMyIssuesResponse> =>
    api().listMyIssues(req),
  testConnection: (): Promise<TestConnectionResponse> => api().testConnection(),
};

export type {
  JiraIssue,
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  TestConnectionResponse,
} from './types';
