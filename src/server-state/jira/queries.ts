import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { jiraApi } from '../../api/jira';
import { jiraKeys } from './keys';

export const jiraQueries = {
  myIssues: (maxResults = 50) =>
    queryOptions({
      queryKey: jiraKeys.myIssues(maxResults),
      queryFn: () => jiraApi.listMyIssues({ maxResults }),
      // External data — always re-fetch when the user asks; never auto-refetch
      // in the background to avoid hammering the API.
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
    }),
  issueDetail: (issueKey: string) =>
    queryOptions({
      queryKey: jiraKeys.issueDetail(issueKey),
      queryFn: () => jiraApi.getIssueDetail({ issueKey }),
      enabled: !!issueKey,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: false,
    }),
  // 세션 게이트 "새 Jira 생성" 폼의 이슈 타입 후보. projectKey 비우면 설정의 첫 키 사용.
  issueTypes: (projectKey = '') =>
    queryOptions({
      queryKey: jiraKeys.issueTypes(projectKey),
      queryFn: () => jiraApi.listIssueTypes(projectKey ? { projectKey } : {}),
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    }),
  // 생성 폼의 프로젝트 선택 박스 — 설정된 프로젝트 목록(이름 보강).
  projects: () =>
    queryOptions({
      queryKey: jiraKeys.projects(),
      queryFn: () => jiraApi.listProjects(),
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    }),
  // 새 티켓의 상위 에픽 후보. projectKey 비우면 설정의 첫 키 사용.
  epics: (projectKey = '') =>
    queryOptions({
      queryKey: jiraKeys.epics(projectKey),
      queryFn: () => jiraApi.listEpics(projectKey ? { projectKey } : {}),
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    }),
  // 기존 티켓 선택용 텍스트 검색. text 가 비면 비활성(myIssues 를 대신 사용).
  search: (text: string) =>
    queryOptions({
      queryKey: jiraKeys.search(text),
      queryFn: () => jiraApi.searchIssues({ text, maxResults: 50 }),
      enabled: text.trim().length > 0,
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: false,
      retry: false,
    }),
};

export const jiraMutations = {
  createIssue: () =>
    mutationOptions({
      mutationKey: [...jiraKeys.all, 'createIssue'] as const,
      mutationFn: jiraApi.createIssue,
    }),
};
