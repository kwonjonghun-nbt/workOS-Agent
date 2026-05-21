import { z } from 'zod';

export const labelNoteSchema = z.object({
  label: z.string().min(1),
  description: z.string(),
  updatedAt: z.string(),
});
export type LabelNote = z.infer<typeof labelNoteSchema>;

export const saveLabelNotesRequestSchema = z.object({
  notes: z.array(labelNoteSchema),
});
export type SaveLabelNotesRequest = z.infer<typeof saveLabelNotesRequestSchema>;

export const searchByLabelRequestSchema = z.object({
  projectKey: z.string().min(1),
  label: z.string().min(1),
});
export type SearchByLabelRequest = z.infer<typeof searchByLabelRequestSchema>;

export type SearchByLabelResponse = {
  issues: Array<{
    key: string;
    summary: string;
    labels: string[];
    status: string;
  }>;
};

export const bulkReplaceRequestSchema = z.object({
  issueKeys: z.array(z.string().min(1)).min(1),
  oldLabel: z.string().min(1),
  newLabel: z.string().min(1),
});
export type BulkReplaceRequest = z.infer<typeof bulkReplaceRequestSchema>;

export type BulkReplaceResponse = {
  successKeys: string[];
  failed: { key: string; error: string }[];
};

export const updateIssueLabelsRequestSchema = z.object({
  issueKey: z.string().min(1),
  labels: z.array(z.string()),
});
export type UpdateIssueLabelsRequest = z.infer<typeof updateIssueLabelsRequestSchema>;

export const suggestLabelRequestSchema = z.object({
  issueKey: z.string().min(1),
  summary: z.string(),
  description: z.string().default(''),
  candidates: z.array(
    z.object({
      label: z.string().min(1),
      description: z.string().optional(),
    }),
  ),
  model: z.string().optional(),
});
export type SuggestLabelRequest = z.infer<typeof suggestLabelRequestSchema>;

export type SuggestLabelResponse = {
  labels: string[];
  reason: string;
};
