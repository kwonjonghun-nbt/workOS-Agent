// Mirror of electron/contracts/jira-ticket-review.ts.
import type { TemplateKind } from './template-types';

export type ReviewSeverity = 'ok' | 'low' | 'medium' | 'high';

export type ReviewSection = {
  key: string;
  title: string;
  currentValue: string;
  gap: string;
  suggestion: string;
  severity: ReviewSeverity;
};

export type TicketReviewResult = {
  issueKey: string;
  kind: TemplateKind;
  summary: string;
  issueType: string;
  parentEpicKey: string | null;
  overall: {
    qualityScore: number;
    headline: string;
    missingSections: string[];
  };
  sections: ReviewSection[];
  proposedDescription: string;
};

export type ReviewIssueRequest = { issueKey: string; model?: string };
export type ReviewIssueResponse = TicketReviewResult;

export type ApplyDescriptionRequest = { issueKey: string; description: string };
export type ApplyDescriptionResponse = { ok: true };
