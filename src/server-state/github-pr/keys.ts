import type { PrStateFilter } from '../../api/github-pr';

export const githubPrKeys = {
  all: ['github-pr'] as const,
  pullRequests: (state: PrStateFilter) =>
    [...githubPrKeys.all, 'pullRequests', { state }] as const,
};
