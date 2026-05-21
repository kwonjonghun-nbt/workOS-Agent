import { net } from 'electron';
import { ApiError } from '../infra/error';

const LOG = (...a: unknown[]) => console.log('[slack.repo]', ...a);
const SLACK_API_BASE = 'https://slack.com/api';

type SlackMessage = {
  ts: string;
  text?: string;
  type?: string;
};

export interface SlackRepository {
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
    const messages: SlackMessage[] = Array.isArray(data.messages)
      ? data.messages
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
