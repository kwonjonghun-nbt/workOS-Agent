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

export const SLACK_SUMMARY_TEMPLATES = [
  'decision',
  'timeline',
  'tldr',
  'issue',
  'qa',
  'perspectives',
] as const;
export type SlackSummaryTemplate = (typeof SLACK_SUMMARY_TEMPLATES)[number];

export type SummarizeRequest = {
  channelId: string;
  threadTs?: string;
  fromUnix: number;
  toUnix: number;
  model?: string;
  focus?: string;
  template?: SlackSummaryTemplate;
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
  replyCount: number;
  isTopic: boolean;
  at: string;
  permalink: string | null;
  replies: SlackThreadReply[];
  repliesLoadedAt: string | null;
};

export type SlackThreadChannelCache = {
  channelId: string;
  channelName: string;
  days: number;
  addedAt: string;
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

export type ListThreadChannelsResponse =
  | { ok: true; channels: SlackThreadChannelMeta[] }
  | { ok: false; error: string };

export type LoadThreadChannelRequest = { channelId: string };
export type LoadThreadChannelResponse =
  | { ok: true; cache: SlackThreadChannelCache }
  | { ok: false; error: string };

export type AddThreadChannelRequest = { channelId: string; days?: number };
export type RefreshThreadChannelRequest = AddThreadChannelRequest;
export type AddOrRefreshThreadChannelResponse =
  | { ok: true; cache: SlackThreadChannelCache }
  | { ok: false; error: string };

export type RemoveThreadChannelRequest = { channelId: string };
export type RemoveThreadChannelResponse =
  | { ok: true }
  | { ok: false; error: string };

export type LoadThreadRepliesRequest = { channelId: string; threadTs: string };
export type LoadThreadRepliesResponse =
  | { ok: true; thread: SlackThreadParent }
  | { ok: false; error: string };
