import { z } from 'zod';

export const reportMetaSchema = z.object({
  filename: z.string(),
  size: z.number(),
  modifiedAt: z.string(),
});
export type ReportMeta = z.infer<typeof reportMetaSchema>;

export const getReportRequestSchema = z.object({
  filename: z.string().min(1),
});
export type GetReportRequest = z.infer<typeof getReportRequestSchema>;

export type GetReportResponse = { filename: string; content: string };

export const saveReportRequestSchema = z.object({
  filename: z.string().min(1).regex(/^[\w\-. ]+\.md$/, '파일명은 .md 로 끝나야 합니다'),
  content: z.string(),
});
export type SaveReportRequest = z.infer<typeof saveReportRequestSchema>;

export const deleteReportRequestSchema = z.object({
  filename: z.string().min(1),
});
export type DeleteReportRequest = z.infer<typeof deleteReportRequestSchema>;

export const generateReportRequestSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  model: z.string().optional(),
});
export type GenerateReportRequest = z.infer<typeof generateReportRequestSchema>;

export type GenerateReportResponse = { content: string };
