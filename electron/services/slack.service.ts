import { ApiError } from '../infra/error';
import {
  parseEmojiList,
  pickActiveToken,
  tsToIso,
  type SlackAuthConfig,
  type SlackTokenMode,
} from '../domain/slack';
import type {
  FetchMessagesRequest,
  FetchMessagesResponse,
  FetchMyReactionsRequest,
  FetchMyReactionsResponse,
  ListChannelsRequest,
  ListChannelsResponse,
  SlackMessageDigestItem,
  SlackTestConnectionResponse,
} from '../contracts/slack';
import type { SlackRawMessage, SlackRepository } from '../repositories/slack.repo';
import type { ExtensionService } from './extension.service';

const LOG = (...a: unknown[]) => console.log('[slack.service]', ...a);

const SLACK_EXTENSION_ID = 'workos.slack';

/**
 * Use-case layer for the Slack Digest extension. Reads tokens from extension
 * settings, delegates HTTP to the repository, and projects raw Slack payloads
 * into the renderer-facing digest shape.
 */
export class SlackService {
  constructor(
    private readonly repo: SlackRepository,
    private readonly extensionService: ExtensionService,
  ) {}

  async resolveAuth(): Promise<{
    token: string;
    mode: SlackTokenMode;
    cfg: SlackAuthConfig;
  }> {
    const enabled = await this.extensionService.isEnabled(SLACK_EXTENSION_ID);
    if (!enabled) {
      throw new ApiError(
        'VALIDATION',
        'Slack 확장이 비활성화되어 있습니다. Extensions 패널에서 활성화하세요.',
      );
    }
    const settings = await this.extensionService.getSettings(
      SLACK_EXTENSION_ID,
    );
    const modeRaw = typeof settings.tokenMode === 'string'
      ? settings.tokenMode.trim()
      : 'user';
    const mode: SlackTokenMode = modeRaw === 'bot' ? 'bot' : 'user';
    const cfg: SlackAuthConfig = {
      mode,
      userToken:
        typeof settings.userToken === 'string'
          ? settings.userToken.trim()
          : '',
      botToken:
        typeof settings.botToken === 'string' ? settings.botToken.trim() : '',
      defaultEmojis:
        typeof settings.defaultEmojis === 'string'
          ? settings.defaultEmojis
          : '',
    };
    const picked = pickActiveToken(cfg);
    if (!picked) {
      throw new ApiError(
        'VALIDATION',
        'Slack 토큰이 설정되지 않았습니다. 설정 탭에서 User 또는 Bot Token 을 입력하세요.',
      );
    }
    return { ...picked, cfg };
  }

  async testConnection(): Promise<SlackTestConnectionResponse> {
    try {
      const { token, mode } = await this.resolveAuth();
      const info = await this.repo.authTest(token);
      return {
        ok: true,
        userId: info.userId,
        userName: info.userName,
        tokenMode: mode,
        teamId: info.teamId,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async listChannels(req: ListChannelsRequest): Promise<ListChannelsResponse> {
    try {
      const { token } = await this.resolveAuth();
      const list = await this.repo.listChannels(token, req.limit ?? 1000);
      const q = req.query?.trim().toLowerCase();
      const filtered = q
        ? list.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.id.toLowerCase().includes(q),
          )
        : list;
      LOG('listChannels total=', list.length, 'after filter=', filtered.length);
      return { ok: true, channels: filtered };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async fetchMessages(req: FetchMessagesRequest): Promise<FetchMessagesResponse> {
    try {
      const { token } = await this.resolveAuth();
      if (req.fromUnix >= req.toUnix) {
        throw new ApiError('VALIDATION', '시작 시각이 종료 시각보다 같거나 큽니다.');
      }
      const maxMessages = req.maxMessages ?? 500;
      const raw = req.threadTs
        ? await this.repo.fetchThreadReplies(
            token,
            req.channelId,
            req.threadTs,
            req.fromUnix,
            req.toUnix,
            maxMessages,
          )
        : await this.repo.fetchChannelHistory(
            token,
            req.channelId,
            req.fromUnix,
            req.toUnix,
            maxMessages,
          );

      const channelName = await this.repo
        .resolveChannelName(token, req.channelId)
        .catch(() => req.channelId);

      const userIds = Array.from(
        new Set(raw.messages.map((m) => m.user).filter((u): u is string => !!u)),
      );
      const nameMap = await this.repo
        .resolveUserNames(token, userIds)
        .catch(() => new Map<string, string>());

      const messages = raw.messages.map((m) =>
        projectMessage(m, nameMap),
      );
      LOG(
        'fetchMessages channel=', req.channelId,
        'thread=', req.threadTs ?? '-',
        'count=', messages.length,
      );
      return { ok: true, messages, truncated: raw.truncated, channelName };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async fetchMyReactions(
    req: FetchMyReactionsRequest,
  ): Promise<FetchMyReactionsResponse> {
    try {
      const { token, mode } = await this.resolveAuth();
      if (mode !== 'user') {
        return {
          ok: false,
          error:
            '내 reaction 수집은 User Token(xoxp) 에서만 동작합니다. 설정에서 사용할 토큰을 "user" 로 바꾸고 User Token 을 입력하세요.',
        };
      }
      const emojiSet = new Set(parseEmojiList(req.emojis));
      if (emojiSet.size === 0) {
        throw new ApiError('VALIDATION', '수집할 이모지 이름이 비어 있습니다.');
      }
      const result = await this.repo.fetchMyReactedItems(
        token,
        emojiSet,
        req.maxPages ?? 5,
      );
      LOG('fetchMyReactions hits=', result.hits.length, 'truncated=', result.truncated);
      return { ok: true, hits: result.hits, truncated: result.truncated };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

function projectMessage(
  m: SlackRawMessage,
  nameMap: Map<string, string>,
): SlackMessageDigestItem {
  const userId = m.user ?? '';
  const userName = userId
    ? nameMap.get(userId) ?? userId
    : m.username ?? (m.bot_id ? `bot:${m.bot_id}` : '');
  return {
    ts: m.ts,
    userId,
    userName,
    text: m.text ?? '',
    threadTs: m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : null,
    at: tsToIso(m.ts),
    permalink: null,
    reactions: (m.reactions ?? []).map((r) => ({
      name: r.name,
      count: typeof r.count === 'number' ? r.count : (r.users?.length ?? 0),
    })),
  };
}
