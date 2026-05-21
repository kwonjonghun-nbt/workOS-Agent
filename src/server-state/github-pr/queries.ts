import { queryOptions } from '@tanstack/react-query';
import { githubPrApi, type PrStateFilter } from '../../api/github-pr';
import { githubPrKeys } from './keys';

export const githubPrQueries = {
  pullRequests: (state: PrStateFilter = 'open') =>
    queryOptions({
      queryKey: githubPrKeys.pullRequests(state),
      queryFn: () => githubPrApi.listPullRequests({ state }),
      // Match the client-jira behavior: poll every 5 minutes, refetch on focus,
      // but never poll while the window is hidden.
      staleTime: 30_000,
      refetchInterval: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchIntervalInBackground: false,
      retry: false,
    }),
};
