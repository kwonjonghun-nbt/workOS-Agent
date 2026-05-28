import type {
  CreateIssueRequest,
  CreateIssueResponse,
  GetIssueDetailRequest,
  GetIssueDetailResponse,
  GetTransitionsRequest,
  GetTransitionsResponse,
  ListIssueChildrenRequest,
  ListIssueChildrenResponse,
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  TestConnectionResponse,
  TransitionIssueRequest,
  TransitionIssueResponse,
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
  createIssue: (req: CreateIssueRequest): Promise<CreateIssueResponse> =>
    api().createIssue(req),
  listIssueChildren: (req: ListIssueChildrenRequest): Promise<ListIssueChildrenResponse> =>
    api().listIssueChildren(req),
  getTransitions: (req: GetTransitionsRequest): Promise<GetTransitionsResponse> =>
    api().getTransitions(req),
  transitionIssue: (req: TransitionIssueRequest): Promise<TransitionIssueResponse> =>
    api().transitionIssue(req),
};

export type {
  CreateIssueRequest,
  CreateIssueResponse,
  GetIssueDetailRequest,
  GetIssueDetailResponse,
  GetTransitionsRequest,
  GetTransitionsResponse,
  JiraChildIssue,
  JiraIssue,
  JiraTransition,
  ListIssueChildrenRequest,
  ListIssueChildrenResponse,
  ListMyIssuesRequest,
  ListMyIssuesResponse,
  TestConnectionResponse,
  TransitionIssueRequest,
  TransitionIssueResponse,
} from './types';
