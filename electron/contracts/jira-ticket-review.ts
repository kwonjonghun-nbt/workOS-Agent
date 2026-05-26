import { z } from 'zod';
import { templateKindSchema } from './jira-ticket-template';

/**
 * 검토 단계의 결과 — 섹션별 현재 내용 / 격차 / 제안 / 심각도.
 */
export const reviewSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  currentValue: z.string().default(''),
  gap: z.string().default(''),
  suggestion: z.string().default(''),
  severity: z.enum(['ok', 'low', 'medium', 'high']).default('low'),
});
export type ReviewSection = z.infer<typeof reviewSectionSchema>;

export const ticketReviewResultSchema = z.object({
  issueKey: z.string(),
  kind: templateKindSchema,
  summary: z.string(),
  issueType: z.string(),
  parentEpicKey: z.string().nullable(),
  overall: z.object({
    qualityScore: z.number().min(0).max(100),
    headline: z.string(),
    missingSections: z.array(z.string()),
  }),
  sections: z.array(reviewSectionSchema),
  proposedDescription: z.string(),
});
export type TicketReviewResult = z.infer<typeof ticketReviewResultSchema>;

export const reviewIssueRequestSchema = z.object({
  issueKey: z.string().min(1),
  model: z.string().optional(),
});
export type ReviewIssueRequest = z.infer<typeof reviewIssueRequestSchema>;

export const applyDescriptionRequestSchema = z.object({
  issueKey: z.string().min(1),
  description: z.string(),
});
export type ApplyDescriptionRequest = z.infer<typeof applyDescriptionRequestSchema>;

export type ReviewIssueResponse = TicketReviewResult;
export type ApplyDescriptionResponse = { ok: true };
