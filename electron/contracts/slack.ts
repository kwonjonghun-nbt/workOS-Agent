import { z } from 'zod';

/**
 * Slack Digest extension contracts. The extension wraps Slack Web API for
 * three user-facing actions:
 *  1. List joined channels / open IMs so the user can pick a target
 *  2. Fetch messages in a channel (optionally a single thread) over a time
 *     window, normalize them to a light projection
 *  3. Ask the host's claude CLI to summarize the fetched window
 *  4. Collect messages the user has reacted to with configured emojis
 *
 * All credentials live in the extension settings (safeStorage-backed); the
 * renderer never sees raw tokens.
 */

export type SlackChannelKind = 'public' | 'private' | 'im' | 'mpim' | 'group';

export type SlackChannelSummary = {
  id: string;
  name: string;
  kind: SlackChannelKind;
  isMember: boolean;
};

export const listChannelsRequestSchema = z.object({
  /** Substring filter applied client-side on the returned list. */
  query: z.string().max(120).optional(),
  /** Cap response size. Slack pages at 1000; service defaults to 500. */
  limit: z.number().int().min(1).max(1000).optional(),
});
export type ListChannelsRequest = z.infer<typeof listChannelsRequestSchema>;

export type ListChannelsResponse =
  | { ok: true; channels: SlackChannelSummary[] }
  | { ok: false; error: string };

export type SlackMessageDigestItem = {
  ts: string;
  /** Slack user id (e.g. U01ABCD). Empty string if missing (bot/app posts). */
  userId: string;
  /** Resolved display name when known, otherwise the raw user id. */
  userName: string;
  text: string;
  /** Parent thread ts when this is a reply; null for top-level messages. */
  threadTs: string | null;
  /** ISO 8601 string derived from ts. */
  at: string;
  /** Deep link back to the source message. */
  permalink: string | null;
  reactions: Array<{ name: string; count: number }>;
};

export const fetchMessagesRequestSchema = z.object({
  channelId: z.string().min(1).max(64),
  /** When set, fetch a single thread (channel + parent ts) instead of the
   *  channel-level history window. */
  threadTs: z.string().min(1).optional(),
  /** Unix seconds, inclusive. */
  fromUnix: z.number().int().nonnegative(),
  /** Unix seconds, exclusive. */
  toUnix: z.number().int().positive(),
  /** Cap total messages returned. Service defaults to 500. */
  maxMessages: z.number().int().min(1).max(1000).optional(),
});
export type FetchMessagesRequest = z.infer<typeof fetchMessagesRequestSchema>;

export type FetchMessagesResponse =
  | {
      ok: true;
      messages: SlackMessageDigestItem[];
      truncated: boolean;
      channelName: string;
    }
  | { ok: false; error: string };

export const fetchMyReactionsRequestSchema = z.object({
  /** Comma- or whitespace-separated emoji names (without colons). */
  emojis: z.string().min(1).max(500),
  /** Hard cap on items scanned (one page = up to 100, service default 5). */
  maxPages: z.number().int().min(1).max(20).optional(),
});
export type FetchMyReactionsRequest = z.infer<
  typeof fetchMyReactionsRequestSchema
>;

export type SlackReactionHit = {
  channelId: string;
  channelName: string;
  ts: string;
  text: string;
  userName: string;
  /** Emoji names I added to this message. */
  emojis: string[];
  at: string;
  permalink: string | null;
};

export type FetchMyReactionsResponse =
  | { ok: true; hits: SlackReactionHit[]; truncated: boolean }
  | { ok: false; error: string };

/**
 * Output-shape preset for summary requests. The service maps each value to a
 * different "요약 형식" block in the prompt while keeping the message log and
 * grounding rules shared.
 */
export const SLACK_SUMMARY_TEMPLATES = [
  'decision',
  'timeline',
  'tldr',
  'issue',
  'qa',
  'perspectives',
] as const;
export type SlackSummaryTemplate = (typeof SLACK_SUMMARY_TEMPLATES)[number];

export const summarizeRequestSchema = z.object({
  channelId: z.string().min(1),
  threadTs: z.string().min(1).optional(),
  fromUnix: z.number().int().nonnegative(),
  toUnix: z.number().int().positive(),
  /** Optional model hint forwarded to claude. */
  model: z.string().max(80).optional(),
  /** Free-form extra instruction injected into the prompt. */
  focus: z.string().max(500).optional(),
  /** Preset that determines the summary output shape. Defaults to "decision". */
  template: z.enum(SLACK_SUMMARY_TEMPLATES).optional(),
});
export type SummarizeRequest = z.infer<typeof summarizeRequestSchema>;

export type SummarizeResponse =
  | {
      ok: true;
      summary: string;
      messageCount: number;
      channelName: string;
    }
  | { ok: false; error: string };

export type SlackTestConnectionResponse =
  | { ok: true; userId: string; userName: string; tokenMode: 'user' | 'bot'; teamId: string | null }
  | { ok: false; error: string };

/**
 * Topic-thread cache surface.
 *
 * Convention: 회사 슬랙은 "[주제]" 형태의 부모 메시지에 스레드로 논의를 잇는
 * 문화를 쓰므로, 채널 단위로 스레드를 가진 부모 메시지를 수집해 영속화한다.
 * 한 번 등록·갱신한 채널은 사용자가 직접 갱신/삭제를 누르기 전까지 추가
 * 네트워크 호출 없이 화면에 보여줄 수 있도록, 부모 메시지뿐 아니라 각 부모의
 * 전체 스레드 답글도 같은 스냅샷에 함께 저장한다.
 */

export type SlackThreadReply = {
  ts: string;
  userId: string;
  userName: string;
  text: string;
  at: string;
};

export type SlackThreadParent = {
  ts: string;
  userId: string;
  userName: string;
  text: string;
  /** Number of replies reported by Slack — populated from message metadata, accurate even before replies are loaded. */
  replyCount: number;
  /** True if the parent text starts with a bracketed topic marker like "[..." or "【...". */
  isTopic: boolean;
  at: string;
  /** Resolved lazily together with replies — null until the user expands the thread. */
  permalink: string | null;
  /** Empty until first expand. After lazy load, contains the full reply list as captured at `repliesLoadedAt`. */
  replies: SlackThreadReply[];
  /** ISO timestamp of the most recent reply fetch for this thread. null = never loaded. */
  repliesLoadedAt: string | null;
};

export type SlackThreadChannelCache = {
  channelId: string;
  channelName: string;
  /** Window size (days) used when this snapshot was captured. */
  days: number;
  /** ISO 8601 — first added to the cache. */
  addedAt: string;
  /** ISO 8601 — last successful refresh. */
  refreshedAt: string;
  threads: SlackThreadParent[];
};

export type SlackThreadChannelMeta = {
  channelId: string;
  channelName: string;
  days: number;
  addedAt: string;
  refreshedAt: string;
  threadCount: number;
};

export const listThreadChannelsResponseTag = 'slack:listThreadChannels';
export type ListThreadChannelsResponse =
  | { ok: true; channels: SlackThreadChannelMeta[] }
  | { ok: false; error: string };

export const loadThreadChannelRequestSchema = z.object({
  channelId: z.string().min(1).max(64),
});
export type LoadThreadChannelRequest = z.infer<
  typeof loadThreadChannelRequestSchema
>;

export type LoadThreadChannelResponse =
  | { ok: true; cache: SlackThreadChannelCache }
  | { ok: false; error: string };

export const addThreadChannelRequestSchema = z.object({
  channelId: z.string().min(1).max(64),
  /** Optional override; service falls back to a sensible default (90). */
  days: z.number().int().min(1).max(365).optional(),
});
export type AddThreadChannelRequest = z.infer<
  typeof addThreadChannelRequestSchema
>;

export const refreshThreadChannelRequestSchema = addThreadChannelRequestSchema;
export type RefreshThreadChannelRequest = AddThreadChannelRequest;

export type AddOrRefreshThreadChannelResponse =
  | { ok: true; cache: SlackThreadChannelCache }
  | { ok: false; error: string };

export const removeThreadChannelRequestSchema = z.object({
  channelId: z.string().min(1).max(64),
});
export type RemoveThreadChannelRequest = z.infer<
  typeof removeThreadChannelRequestSchema
>;

export type RemoveThreadChannelResponse =
  | { ok: true }
  | { ok: false; error: string };

export const loadThreadRepliesRequestSchema = z.object({
  channelId: z.string().min(1).max(64),
  threadTs: z.string().min(1).max(64),
});
export type LoadThreadRepliesRequest = z.infer<
  typeof loadThreadRepliesRequestSchema
>;

export type LoadThreadRepliesResponse =
  | { ok: true; thread: SlackThreadParent }
  | { ok: false; error: string };
