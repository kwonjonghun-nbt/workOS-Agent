import { queryOptions } from '@tanstack/react-query';
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
  issueChildren: (parentKey: string) =>
    queryOptions({
      queryKey: jiraKeys.issueChildren(parentKey),
      queryFn: () => jiraApi.listIssueChildren({ parentKey }),
      enabled: !!parentKey,
      staleTime: 0,
      refetchOnWindowFocus: false,
      retry: false,
    }),
  transitions: (issueKey: string) =>
    queryOptions({
      queryKey: jiraKeys.transitions(issueKey),
      queryFn: () => jiraApi.getTransitions({ issueKey }),
      enabled: !!issueKey,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: false,
    }),
};
