import { ApiError } from '../infra/error';
import { tsToIso } from '../domain/slack';
import type {
  AddOrRefreshThreadChannelResponse,
  AddThreadChannelRequest,
  ListThreadChannelsResponse,
  LoadThreadChannelRequest,
  LoadThreadChannelResponse,
  LoadThreadRepliesRequest,
  LoadThreadRepliesResponse,
  RefreshThreadChannelRequest,
  RemoveThreadChannelRequest,
  RemoveThreadChannelResponse,
  SlackThreadChannelCache,
  SlackThreadParent,
  SlackThreadReply,
} from '../contracts/slack';
import type { SlackRawMessage, SlackRepository } from '../repositories/slack.repo';
import type { SlackThreadsRepository } from '../repositories/slack-threads.repo';
import type { SlackService } from './slack.service';

const LOG = (...a: unknown[]) => console.log('[slack-threads.service]', ...a);

const DEFAULT_DAYS = 90;
const MAX_HISTORY_MESSAGES = 1000;
const MAX_REPLIES_PER_THREAD = 500;

/**
 * Use-case layer for the "topic thread" list. Snapshots are captured in two
 * phases to keep refreshes fast:
 *
 *  1. `add` / `refresh` — walks channel history over the configured window and
 *     records the parent metadata of every threaded message. No reply fetch,
 *     no permalink lookup, so a 90-day channel with hundreds of threads still
 *     finishes in one short burst of `conversations.history` calls.
 *  2. `loadReplies` — fetches the full reply list (and permalink) for a single
 *     thread on demand, then writes the result back into the cached snapshot.
 *     Subsequent expands serve straight off disk.
 */
export class SlackThreadsService {
  constructor(
    private readonly slack: SlackService,
    private readonly repo: SlackRepository,
    private readonly store: SlackThreadsRepository,
  ) {}

  async listChannels(): Promise<ListThreadChannelsResponse> {
    try {
      const channels = await this.store.listMeta();
      return { ok: true, channels };
    } catch (err) {
      return { ok: false, error: errMsg(err) };
    }
  }

  async load(
    req: LoadThreadChannelRequest,
  ): Promise<LoadThreadChannelResponse> {
    try {
      const cache = await this.store.load(req.channelId);
      if (!cache) {
        return {
          ok: false,
          error: '아직 캐시된 데이터가 없습니다. 먼저 채널을 추가하거나 갱신하세요.',
        };
      }
      return { ok: true, cache };
    } catch (err) {
      return { ok: false, error: errMsg(err) };
    }
  }

  async add(
    req: AddThreadChannelRequest,
  ): Promise<AddOrRefreshThreadChannelResponse> {
    return this.captureSnapshot(req, false);
  }

  async refresh(
    req: RefreshThreadChannelRequest,
  ): Promise<AddOrRefreshThreadChannelResponse> {
    return this.captureSnapshot(req, true);
  }

  async remove(
    req: RemoveThreadChannelRequest,
  ): Promise<RemoveThreadChannelResponse> {
    try {
      await this.store.remove(req.channelId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: errMsg(err) };
    }
  }

  async loadReplies(
    req: LoadThreadRepliesRequest,
  ): Promise<LoadThreadRepliesResponse> {
    try {
      const { token } = await this.slack.resolveAuth();
      const cache = await this.store.load(req.channelId);
      if (!cache) {
        throw new ApiError(
          'NOT_FOUND',
          '캐시된 채널 데이터가 없습니다. 채널을 다시 추가하세요.',
        );
      }
      const idx = cache.threads.findIndex((t) => t.ts === req.threadTs);
      if (idx < 0) {
        throw new ApiError(
          'NOT_FOUND',
          '스냅샷에서 스레드를 찾지 못했습니다. 채널 갱신 후 다시 시도하세요.',
        );
      }

      const toUnix = Math.floor(Date.now() / 1000);
      const repliesPage = await this.repo.fetchThreadReplies(
        token,
        req.channelId,
        req.threadTs,
        0,
        toUnix,
        MAX_REPLIES_PER_THREAD,
      );
      const replyMessages = repliesPage.messages.filter(
        (r) => r.ts !== req.threadTs,
      );
      const replyUserIds = Array.from(
        new Set(replyMessages.map((r) => r.user).filter((u): u is string => !!u)),
      );
      const nameMap = await this.repo
        .resolveUserNames(token, replyUserIds)
        .catch(() => new Map<string, string>());
      const replies: SlackThreadReply[] = replyMessages.map((r) =>
        projectReply(r, nameMap),
      );

      const permalink = await this.repo
        .getPermalink(token, req.channelId, req.threadTs)
        .catch(() => null);

      const updated: SlackThreadParent = {
        ...cache.threads[idx],
        replies,
        permalink,
        repliesLoadedAt: new Date().toISOString(),
      };
      const nextThreads = [...cache.threads];
      nextThreads[idx] = updated;
      await this.store.save({ ...cache, threads: nextThreads });
      LOG('loadReplies channel=', req.channelId, 'ts=', req.threadTs, 'count=', replies.length);
      return { ok: true, thread: updated };
    } catch (err) {
      return { ok: false, error: errMsg(err) };
    }
  }

  private async captureSnapshot(
    req: AddThreadChannelRequest,
    isRefresh: boolean,
  ): Promise<AddOrRefreshThreadChannelResponse> {
    try {
      const { token } = await this.slack.resolveAuth();
      const days = req.days ?? DEFAULT_DAYS;
      const toUnix = Math.floor(Date.now() / 1000);
      const fromUnix = toUnix - days * 24 * 60 * 60;

      const channelName = await this.repo
        .resolveChannelName(token, req.channelId)
        .catch(() => req.channelId);

      const history = await this.repo.fetchChannelHistory(
        token,
        req.channelId,
        fromUnix,
        toUnix,
        MAX_HISTORY_MESSAGES,
      );

      const parentMessages = history.messages.filter(isThreadParent);
      LOG(
        'captureSnapshot channel=', req.channelId,
        'days=', days,
        'historyCount=', history.messages.length,
        'parentCount=', parentMessages.length,
      );

      const userIds = parentMessages
        .map((m) => m.user)
        .filter((u): u is string => !!u);
      const nameMap = await this.repo
        .resolveUserNames(token, userIds)
        .catch(() => new Map<string, string>());

      // Preserve previously loaded replies/permalinks across refreshes so the
      // user doesn't lose offline content for threads they already expanded.
      const prevByTs = new Map<string, SlackThreadParent>();
      const prev = isRefresh ? await this.store.load(req.channelId) : null;
      if (prev) {
        for (const t of prev.threads) prevByTs.set(t.ts, t);
      }

      const projected: SlackThreadParent[] = parentMessages.map((m) => {
        const prior = prevByTs.get(m.ts);
        return projectParent(m, nameMap, prior);
      });

      const now = new Date().toISOString();
      const cache: SlackThreadChannelCache = {
        channelId: req.channelId,
        channelName,
        days,
        addedAt: prev?.addedAt ?? now,
        refreshedAt: now,
        threads: projected,
      };
      await this.store.save(cache);
      return { ok: true, cache };
    } catch (err) {
      return { ok: false, error: errMsg(err) };
    }
  }
}

function isThreadParent(m: SlackRawMessage): boolean {
  const isTopLevel = !m.thread_ts || m.thread_ts === m.ts;
  if (!isTopLevel) return false;
  const replies = typeof m.reply_count === 'number' ? m.reply_count : 0;
  return replies > 0;
}

function projectReply(
  r: SlackRawMessage,
  nameMap: Map<string, string>,
): SlackThreadReply {
  const userId = r.user ?? '';
  const userName = userId
    ? nameMap.get(userId) ?? userId
    : r.username ?? (r.bot_id ? `bot:${r.bot_id}` : '');
  return {
    ts: r.ts,
    userId,
    userName,
    text: r.text ?? '',
    at: tsToIso(r.ts),
  };
}

function projectParent(
  m: SlackRawMessage,
  nameMap: Map<string, string>,
  prior: SlackThreadParent | undefined,
): SlackThreadParent {
  const userId = m.user ?? '';
  const userName = userId
    ? nameMap.get(userId) ?? userId
    : m.username ?? (m.bot_id ? `bot:${m.bot_id}` : '');
  const text = m.text ?? '';
  const replyCount =
    typeof m.reply_count === 'number' ? m.reply_count : prior?.replyCount ?? 0;
  return {
    ts: m.ts,
    userId,
    userName,
    text,
    replyCount,
    isTopic: isTopicText(text),
    at: tsToIso(m.ts),
    permalink: prior?.permalink ?? null,
    replies: prior?.replies ?? [],
    repliesLoadedAt: prior?.repliesLoadedAt ?? null,
  };
}

/** Heuristic: parent message body opens with a bracket-style topic marker. */
function isTopicText(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed) return false;
  return /^[[【〔《「『]/.test(trimmed);
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
