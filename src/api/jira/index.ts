import type {
  GetIssueDetailRequest,
  GetIssueDetailResponse,
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
  getIssueDetail: (req: GetIssueDetailRequest): Promise<GetIssueDetailResponse> =>
    api().getIssueDetail(req),
};

export type {
  GetIssueDetailRequest,
  GetIssueDetailResponse,
  JiraIssue,
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  TestConnectionResponse,
} from './types';
