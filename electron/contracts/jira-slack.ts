import { z } from 'zod';

/**
 * Slack-side daily-share contract for the Jira extension. Configuration values
 * (botToken, channelId, searchText, sendTime) live in the Jira extension
 * settings; these IPC calls only need transient parameters for tests / probes
 * + a marker for the manual "send now" action.
 */

export const testSlackConnectionRequestSchema = z
  .object({
    botToken: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
  })
  .default({});
export type TestSlackConnectionRequest = z.infer<
  typeof testSlackConnectionRequestSchema
>;

export type TestSlackConnectionResponse =
  | { ok: true }
  | { ok: false; error: string };

export const findThreadMessageRequestSchema = z
  .object({
    botToken: z.string().min(1).optional(),
    channelId: z.string().min(1).optional(),
    searchText: z.string().min(1).optional(),
  })
  .default({});
export type FindThreadMessageRequest = z.infer<
  typeof findThreadMessageRequestSchema
>;

export type FindThreadMessageResponse =
  | { ok: true; found: true; ts: string; text: string }
  | { ok: true; found: false }
  | { ok: false; error: string };

export type SendDailyReportResponse =
  | { ok: true; sentCount: number; threadTs: string }
  | { ok: false; error: string };

export type PreviewDailyReportEntry = {
  assignee: string;
  message: string;
};

export type PreviewDailyReportResponse =
  | { ok: true; entries: PreviewDailyReportEntry[] }
  | { ok: false; error: string };
