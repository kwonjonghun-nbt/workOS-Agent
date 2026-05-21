/**
 * Renderer-facing types for the Jira ↔ Slack daily-share IPC surface.
 * Mirrors `electron/contracts/jira-slack.ts` but kept type-only (no zod, no
 * runtime imports) so the renderer layer stays free of main-process deps.
 */

export type TestSlackConnectionRequest = {
  botToken?: string;
  channelId?: string;
};

export type TestSlackConnectionResponse =
  | { ok: true }
  | { ok: false; error: string };

export type FindThreadMessageRequest = {
  botToken?: string;
  channelId?: string;
  searchText?: string;
};

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
