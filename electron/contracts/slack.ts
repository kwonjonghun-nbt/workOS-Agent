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

export const summarizeRequestSchema = z.object({
  channelId: z.string().min(1),
  threadTs: z.string().min(1).optional(),
  fromUnix: z.number().int().nonnegative(),
  toUnix: z.number().int().positive(),
  /** Optional model hint forwarded to claude. */
  model: z.string().max(80).optional(),
  /** Free-form extra instruction injected into the prompt. */
  focus: z.string().max(500).optional(),
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
