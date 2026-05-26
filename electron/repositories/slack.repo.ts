import { net } from 'electron';
import { ApiError } from '../infra/error';
import {
  classifyChannel,
  tsToIso,
  type SlackTokenMode,
} from '../domain/slack';
import type {
  SlackChannelSummary,
  SlackReactionHit,
} from '../contracts/slack';

const LOG = (...a: unknown[]) => console.log('[slack.repo]', ...a);
const SLACK_API_BASE = 'https://slack.com/api';

type RawMessage = {
  ts: string;
  text?: string;
  user?: string;
  bot_id?: string;
  username?: string;
  type?: string;
  subtype?: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{ name: string; users?: string[]; count?: number }>;
};

export interface SlackRepository {
  // ----- Jira daily-share legacy surface (kept stable) -----
  testChannel(
    botToken: string,
    channelId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
  findTodayMessage(
    botToken: string,
    channelId: string,
    searchText: string,
  ): Promise<{ ts: string; text: string } | null>;
  postThreadReply(
    botToken: string,
    channelId: string,
    threadTs: string,
    text: string,
  ): Promise<void>;

  // ----- Slack Digest extension surface -----
  authTest(token: string): Promise<{
    userId: string;
    userName: string;
    teamId: string | null;
  }>;
  listChannels(
    token: string,
    limit: number,
  ): Promise<SlackChannelSummary[]>;
  fetchChannelHistory(
    token: string,
    channelId: string,
    fromUnix: number,
    toUnix: number,
    maxMessages: number,
  ): Promise<{ messages: RawMessage[]; truncated: boolean }>;
  fetchThreadReplies(
    token: string,
    channelId: string,
    threadTs: string,
    fromUnix: number,
    toUnix: number,
    maxMessages: number,
  ): Promise<{ messages: RawMessage[]; truncated: boolean }>;
  fetchMyReactedItems(
    token: string,
    emojiSet: Set<string>,
    maxPages: number,
  ): Promise<{ hits: SlackReactionHit[]; truncated: boolean }>;
  resolveUserNames(
    token: string,
    userIds: string[],
  ): Promise<Map<string, string>>;
  resolveChannelName(token: string, channelId: string): Promise<string>;
  getPermalink(
    token: string,
    channelId: string,
    ts: string,
  ): Promise<string | null>;
}

export class HttpSlackRepository implements SlackRepository {
  async testChannel(
    botToken: string,
    channelId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const data = await this.get(botToken, 'conversations.info', {
        channel: channelId,
      });
      if (!data.ok) {
        return { ok: false, error: String(data.error ?? 'unknown') };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async findTodayMessage(
    botToken: string,
    channelId: string,
    searchText: string,
  ): Promise<{ ts: string; text: string } | null> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const oldest = Math.floor(todayStart.getTime() / 1000);
    const data = await this.get(botToken, 'conversations.history', {
      channel: channelId,
      oldest: String(oldest),
      limit: '100',
    });
    if (!data.ok) {
      throw new ApiError(
        'INTERNAL',
        `Slack conversations.history 실패: ${data.error}`,
      );
    }
    const messages: RawMessage[] = Array.isArray(data.messages)
      ? (data.messages as RawMessage[])
      : [];
    const found = messages.find((m) =>
      typeof m.text === 'string' ? m.text.includes(searchText) : false,
    );
    if (!found) return null;
    return { ts: found.ts, text: found.text ?? '' };
  }

  async postThreadReply(
    botToken: string,
    channelId: string,
    threadTs: string,
    text: string,
  ): Promise<void> {
    const data = await this.post(botToken, 'chat.postMessage', {
      channel: channelId,
      thread_ts: threadTs,
      text,
    });
    if (!data.ok) {
      throw new ApiError(
        'INTERNAL',
        `Slack chat.postMessage 실패: ${data.error}`,
      );
    }
  }

  // ----- Digest surface -----

  async authTest(token: string): Promise<{
    userId: string;
    userName: string;
    teamId: string | null;
  }> {
    const data = await this.get(token, 'auth.test', {});
    if (!data.ok) {
      throw new ApiError('INTERNAL', `auth.test 실패: ${data.error}`);
    }
    return {
      userId: String(data.user_id ?? ''),
      userName: String(data.user ?? ''),
      teamId: typeof data.team_id === 'string' ? data.team_id : null,
    };
  }

  async listChannels(
    token: string,
    limit: number,
  ): Promise<SlackChannelSummary[]> {
    const out: SlackChannelSummary[] = [];
    let cursor: string | undefined;
    // Slack caps per-request at 1000; loop until we hit the user-facing cap.
    while (out.length < limit) {
      const params: Record<string, string> = {
        types: 'public_channel,private_channel,mpim,im',
        exclude_archived: 'true',
        limit: String(Math.min(1000, limit - out.length)),
      };
      if (cursor) params.cursor = cursor;
      const data = await this.get(token, 'conversations.list', params);
      if (!data.ok) {
        throw new ApiError(
          'INTERNAL',
          `conversations.list 실패: ${data.error}`,
        );
      }
      const channels = Array.isArray(data.channels)
        ? (data.channels as Array<Record<string, unknown>>)
        : [];
      for (const c of channels) {
        const id = String(c.id ?? '');
        if (!id) continue;
        const name = typeof c.name === 'string' && c.name
          ? c.name
          : typeof c.user === 'string'
            ? `DM:${c.user}`
            : id;
        out.push({
          id,
          name,
          kind: classifyChannel(c as {
            is_im?: boolean;
            is_mpim?: boolean;
            is_private?: boolean;
            is_group?: boolean;
          }),
          isMember: c.is_member === true || c.is_im === true || c.is_mpim === true,
        });
      }
      const meta = data.response_metadata as
        | { next_cursor?: string }
        | undefined;
      const nextCursor = meta?.next_cursor;
      if (!nextCursor) break;
      cursor = nextCursor;
    }
    return out;
  }

  async fetchChannelHistory(
    token: string,
    channelId: string,
    fromUnix: number,
    toUnix: number,
    maxMessages: number,
  ): Promise<{ messages: RawMessage[]; truncated: boolean }> {
    const acc: RawMessage[] = [];
    let cursor: string | undefined;
    let truncated = false;
    while (acc.length < maxMessages) {
      const params: Record<string, string> = {
        channel: channelId,
        oldest: String(fromUnix),
        latest: String(toUnix),
        inclusive: 'true',
        limit: String(Math.min(200, maxMessages - acc.length)),
      };
      if (cursor) params.cursor = cursor;
      const data = await this.get(token, 'conversations.history', params);
      if (!data.ok) {
        throw new ApiError(
          'INTERNAL',
          `conversations.history 실패: ${data.error}`,
        );
      }
      const page = Array.isArray(data.messages)
        ? (data.messages as RawMessage[])
        : [];
      acc.push(...page);
      const meta = data.response_metadata as
        | { next_cursor?: string }
        | undefined;
      const nextCursor = meta?.next_cursor;
      if (!nextCursor || data.has_more !== true) break;
      cursor = nextCursor;
    }
    if (acc.length >= maxMessages) truncated = true;
    // Slack returns newest-first; reverse so summary prompts read chronologically.
    return { messages: acc.reverse(), truncated };
  }

  async fetchThreadReplies(
    token: string,
    channelId: string,
    threadTs: string,
    fromUnix: number,
    toUnix: number,
    maxMessages: number,
  ): Promise<{ messages: RawMessage[]; truncated: boolean }> {
    const acc: RawMessage[] = [];
    let cursor: string | undefined;
    while (acc.length < maxMessages) {
      const params: Record<string, string> = {
        channel: channelId,
        ts: threadTs,
        limit: String(Math.min(200, maxMessages - acc.length)),
      };
      if (cursor) params.cursor = cursor;
      const data = await this.get(token, 'conversations.replies', params);
      if (!data.ok) {
        throw new ApiError(
          'INTERNAL',
          `conversations.replies 실패: ${data.error}`,
        );
      }
      const page = Array.isArray(data.messages)
        ? (data.messages as RawMessage[])
        : [];
      acc.push(...page);
      const meta = data.response_metadata as
        | { next_cursor?: string }
        | undefined;
      if (!meta?.next_cursor || data.has_more !== true) break;
      cursor = meta.next_cursor;
    }
    // Apply window filter client-side — conversations.replies has no oldest/latest.
    const filtered = acc.filter((m) => {
      const sec = Number(m.ts.split('.')[0]);
      return Number.isFinite(sec) && sec >= fromUnix && sec <= toUnix;
    });
    return { messages: filtered, truncated: acc.length >= maxMessages };
  }

  async fetchMyReactedItems(
    token: string,
    emojiSet: Set<string>,
    maxPages: number,
  ): Promise<{ hits: SlackReactionHit[]; truncated: boolean }> {
    const hits: SlackReactionHit[] = [];
    let page = 1;
    let truncated = false;
    const channelNameCache = new Map<string, string>();
    for (; page <= maxPages; page += 1) {
      const data = await this.get(token, 'reactions.list', {
        count: '100',
        page: String(page),
        full: 'true',
      });
      if (!data.ok) {
        throw new ApiError(
          'INTERNAL',
          `reactions.list 실패: ${data.error}`,
        );
      }
      const items = Array.isArray(data.items)
        ? (data.items as Array<Record<string, unknown>>)
        : [];
      for (const item of items) {
        if (item.type !== 'message') continue;
        const message = item.message as RawMessage | undefined;
        const channelId = typeof item.channel === 'string' ? item.channel : '';
        if (!message || !channelId) continue;
        const matched = (message.reactions ?? [])
          .map((r) => r.name)
          .filter((name) => emojiSet.has(name));
        if (matched.length === 0) continue;
        let channelName = channelNameCache.get(channelId);
        if (channelName === undefined) {
          try {
            channelName = await this.resolveChannelName(token, channelId);
          } catch {
            channelName = channelId;
          }
          channelNameCache.set(channelId, channelName);
        }
        hits.push({
          channelId,
          channelName,
          ts: message.ts,
          text: message.text ?? '',
          userName: message.username ?? message.user ?? '',
          emojis: matched,
          at: tsToIso(message.ts),
          permalink: null,
        });
      }
      const paging = data.paging as
        | { pages?: number; page?: number }
        | undefined;
      if (!paging || typeof paging.pages !== 'number') break;
      if (page >= paging.pages) break;
      if (page >= maxPages) {
        truncated = paging.pages > maxPages;
        break;
      }
    }
    return { hits, truncated };
  }

  async resolveUserNames(
    token: string,
    userIds: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const unique = Array.from(new Set(userIds.filter((u) => u)));
    // users.info is per-user; cap fan-out so a wide channel doesn't burn rate.
    const capped = unique.slice(0, 50);
    for (const uid of capped) {
      try {
        const data = await this.get(token, 'users.info', { user: uid });
        if (!data.ok) continue;
        const user = data.user as
          | { profile?: { display_name?: string; real_name?: string }; name?: string }
          | undefined;
        const name =
          user?.profile?.display_name ||
          user?.profile?.real_name ||
          user?.name ||
          uid;
        out.set(uid, name);
      } catch {
        // best-effort; fall through to id
      }
    }
    return out;
  }

  async resolveChannelName(token: string, channelId: string): Promise<string> {
    const data = await this.get(token, 'conversations.info', {
      channel: channelId,
    });
    if (!data.ok) return channelId;
    const info = data.channel as
      | { name?: string; user?: string; is_im?: boolean }
      | undefined;
    if (info?.name) return info.name;
    if (info?.is_im && info.user) return `DM:${info.user}`;
    return channelId;
  }

  async getPermalink(
    token: string,
    channelId: string,
    ts: string,
  ): Promise<string | null> {
    try {
      const data = await this.get(token, 'chat.getPermalink', {
        channel: channelId,
        message_ts: ts,
      });
      if (!data.ok) return null;
      return typeof data.permalink === 'string' ? data.permalink : null;
    } catch {
      return null;
    }
  }

  private async get(
    token: string,
    method: string,
    params: Record<string, string>,
  ): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
    const url = new URL(`${SLACK_API_BASE}/${method}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    LOG('GET', method);
    const res = await net.fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new ApiError(
        'INTERNAL',
        `Slack API ${method} HTTP ${res.status}`,
      );
    }
    return (await res.json()) as { ok: boolean; error?: string };
  }

  private async post(
    token: string,
    method: string,
    body: Record<string, string>,
  ): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
    LOG('POST', method);
    const res = await net.fetch(`${SLACK_API_BASE}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new ApiError(
        'INTERNAL',
        `Slack API ${method} HTTP ${res.status}`,
      );
    }
    return (await res.json()) as { ok: boolean; error?: string };
  }
}

// Re-export for downstream consumers that need the raw message shape.
export type { RawMessage as SlackRawMessage };
// Re-export the mode union for callers that wire token selection.
export type { SlackTokenMode };
