/**
 * Renderer-facing types for the Slack Digest extension IPC surface. Mirrors
 * `electron/contracts/slack.ts` without importing zod or anything main-only.
 */

export type SlackChannelKind = 'public' | 'private' | 'im' | 'mpim' | 'group';

export type SlackChannelSummary = {
  id: string;
  name: string;
  kind: SlackChannelKind;
  isMember: boolean;
};

export type ListChannelsRequest = {
  query?: string;
  limit?: number;
};

export type ListChannelsResponse =
  | { ok: true; channels: SlackChannelSummary[] }
  | { ok: false; error: string };

export type SlackMessageDigestItem = {
  ts: string;
  userId: string;
  userName: string;
  text: string;
  threadTs: string | null;
  at: string;
  permalink: string | null;
  reactions: Array<{ name: string; count: number }>;
};

export type FetchMessagesRequest = {
  channelId: string;
  threadTs?: string;
  fromUnix: number;
  toUnix: number;
  maxMessages?: number;
};

export type FetchMessagesResponse =
  | {
      ok: true;
      messages: SlackMessageDigestItem[];
      truncated: boolean;
      channelName: string;
    }
  | { ok: false; error: string };

export type FetchMyReactionsRequest = {
  emojis: string;
  maxPages?: number;
};

export type SlackReactionHit = {
  channelId: string;
  channelName: string;
  ts: string;
  text: string;
  userName: string;
  emojis: string[];
  at: string;
  permalink: string | null;
};

export type FetchMyReactionsResponse =
  | { ok: true; hits: SlackReactionHit[]; truncated: boolean }
  | { ok: false; error: string };

export type SummarizeRequest = {
  channelId: string;
  threadTs?: string;
  fromUnix: number;
  toUnix: number;
  model?: string;
  focus?: string;
};

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
