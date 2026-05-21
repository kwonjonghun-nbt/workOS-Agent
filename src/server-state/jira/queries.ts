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
};
