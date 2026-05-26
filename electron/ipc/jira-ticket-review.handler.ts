import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  applyDescriptionRequestSchema,
  reviewIssueRequestSchema,
  type ApplyDescriptionResponse,
  type ReviewIssueResponse,
} from '../contracts/jira-ticket-review';
import type { JiraTicketReviewService } from '../services/jira-ticket-review.service';
import { toApiError } from '../infra/error';

export function registerJiraTicketReviewHandlers(
  service: JiraTicketReviewService,
): void {
  ipcMain.handle(
    CHANNELS.jiraTicketReview.review,
    async (_e, raw): Promise<ReviewIssueResponse> => {
      try {
        const req = reviewIssueRequestSchema.parse(raw);
        return await service.review(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraTicketReview.apply,
    async (_e, raw): Promise<ApplyDescriptionResponse> => {
      try {
        const req = applyDescriptionRequestSchema.parse(raw);
        return await service.apply(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
