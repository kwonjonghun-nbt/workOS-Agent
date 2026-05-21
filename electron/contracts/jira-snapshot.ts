import { z } from 'zod';

/**
 * Renderer-facing types for the local Jira snapshot store. The main process
 * fetches issues from Atlassian on a schedule, normalizes them, and persists
 * to userData/data/{latest.json, raw/<date>/<time>.json, meta.json}. The
 * dashboard reads exclusively from this store — never from the live Jira API.
 */

export const normalizedIssueSchema = z.object({
  id: z.string(),
  key: z.string(),
  summary: z.string(),
  status: z.string(),
  statusCategory: z.string(),
  priority: z.string().nullable(),
  issueType: z.string(),
  assignee: z.string().nullable(),
  assigneeEmail: z.string().nullable(),
  reporter: z.string().nullable(),
  created: z.string(),
  updated: z.string(),
  url: z.string(),
  labels: z.array(z.string()),
  dueDate: z.string().nullable(),
  startDate: z.string().nullable(),
  storyPoints: z.number().nullable(),
  parentKey: z.string().nullable(),
});
export type NormalizedIssue = z.infer<typeof normalizedIssueSchema>;

export const storedDataSchema = z.object({
  syncedAt: z.string(),
  source: z.object({
    baseUrl: z.string(),
    projectKeys: z.array(z.string()),
  }),
  issues: z.array(normalizedIssueSchema),
  totalCount: z.number(),
});
export type StoredData = z.infer<typeof storedDataSchema>;

export const syncHistoryEntrySchema = z.object({
  at: z.string(),
  trigger: z.enum(['manual', 'scheduled']),
  ok: z.boolean(),
  count: z.number(),
  error: z.string().optional(),
});
export type SyncHistoryEntry = z.infer<typeof syncHistoryEntrySchema>;

export const metaDataSchema = z.object({
  lastSyncAt: z.string().nullable(),
  history: z.array(syncHistoryEntrySchema),
});
export type MetaData = z.infer<typeof metaDataSchema>;

// ---------- IPC requests / responses ----------

export const triggerSyncRequestSchema = z.object({
  trigger: z.enum(['manual', 'scheduled']).default('manual'),
});
export type TriggerSyncRequest = z.infer<typeof triggerSyncRequestSchema>;

export type TriggerSyncResponse = {
  ok: true;
  count: number;
  syncedAt: string;
};

export type GetLatestResponse = StoredData | null;
export type GetMetaResponse = MetaData;

export type SyncProgressEvent = {
  phase: 'started' | 'fetching' | 'saving' | 'completed' | 'failed';
  message?: string;
  count?: number;
};
