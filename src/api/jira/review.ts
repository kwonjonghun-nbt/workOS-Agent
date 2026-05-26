import type {
  ApplyDescriptionRequest,
  ApplyDescriptionResponse,
  ReviewIssueRequest,
  ReviewIssueResponse,
} from './review-types';

function api() {
  return window.electronAPI.jiraTicketReview;
}

export const jiraTicketReviewApi = {
  review: (req: ReviewIssueRequest): Promise<ReviewIssueResponse> => api().review(req),
  apply: (req: ApplyDescriptionRequest): Promise<ApplyDescriptionResponse> =>
    api().apply(req),
};

export type {
  ApplyDescriptionRequest,
  ApplyDescriptionResponse,
  ReviewIssueRequest,
  ReviewIssueResponse,
  ReviewSection,
  ReviewSeverity,
  TicketReviewResult,
} from './review-types';
