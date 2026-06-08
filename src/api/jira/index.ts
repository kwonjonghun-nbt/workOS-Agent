import type {
  CreateIssueRequest,
  CreateIssueResponse,
  GetIssueDetailRequest,
  GetIssueDetailResponse,
  ListEpicsRequest,
  ListEpicsResponse,
  ListIssueTypesRequest,
  ListIssueTypesResponse,
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  ListProjectsResponse,
  SearchIssuesRequest,
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
  listIssueTypes: (req: ListIssueTypesRequest = {}): Promise<ListIssueTypesResponse> =>
    api().listIssueTypes(req),
  createIssue: (req: CreateIssueRequest): Promise<CreateIssueResponse> =>
    api().createIssue(req),
  listEpics: (req: ListEpicsRequest = {}): Promise<ListEpicsResponse> => api().listEpics(req),
  searchIssues: (req: SearchIssuesRequest): Promise<ListMyIssuesResponse> =>
    api().searchIssues(req),
  listProjects: (): Promise<ListProjectsResponse> => api().listProjects(),
};

export type {
  CreateIssueRequest,
  CreateIssueResponse,
  GetIssueDetailRequest,
  GetIssueDetailResponse,
  JiraEpic,
  JiraIssue,
  JiraIssueType,
  JiraProject,
  ListEpicsRequest,
  ListEpicsResponse,
  ListIssueTypesRequest,
  ListIssueTypesResponse,
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  ListProjectsResponse,
  SearchIssuesRequest,
  TestConnectionResponse,
} from './types';
