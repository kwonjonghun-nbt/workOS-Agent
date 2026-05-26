import { mutationOptions } from '@tanstack/react-query';
import { jiraTicketReviewApi } from '../../api/jira/review';
import { jiraKeys } from './keys';

export const jiraReviewKeys = {
  all: [...jiraKeys.all, 'ticket-review'] as const,
};

export const jiraReviewMutations = {
  review: () =>
    mutationOptions({
      mutationKey: [...jiraReviewKeys.all, 'review'] as const,
      mutationFn: jiraTicketReviewApi.review,
    }),
  apply: () =>
    mutationOptions({
      mutationKey: [...jiraReviewKeys.all, 'apply'] as const,
      mutationFn: jiraTicketReviewApi.apply,
    }),
};
