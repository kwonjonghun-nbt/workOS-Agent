import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { slackApi } from '../../api/slack';
import { slackKeys } from './keys';
import type {
  AddThreadChannelRequest,
  FetchMessagesRequest,
  FetchMyReactionsRequest,
  ListChannelsResponse,
  LoadThreadRepliesRequest,
  RefreshThreadChannelRequest,
  RemoveThreadChannelRequest,
  SummarizeRequest,
} from '../../api/slack';

const CHANNEL_CACHE_KEY = 'workos.slack.channels.v1';

/**
 * Slack channel lists are stable enough that we keep them in localStorage
 * across sessions and never auto-refetch. The user explicitly clicks
 * "refresh" when they want to pull a fresh list from Slack.
 */
function readChannelCache(): ListChannelsResponse | undefined {
  try {
    const raw = localStorage.getItem(CHANNEL_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as ListChannelsResponse;
    if (parsed && parsed.ok === true && Array.isArray(parsed.channels)) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function writeChannelCache(data: ListChannelsResponse): void {
  try {
    if (data.ok) {
      localStorage.setItem(CHANNEL_CACHE_KEY, JSON.stringify(data));
    }
  } catch {
    // quota exceeded or storage unavailable — silently ignore
  }
}

export const slackQueries = {
  listChannels: () =>
    queryOptions({
      queryKey: slackKeys.channels(),
      queryFn: async () => {
        const res = await slackApi.listChannels({});
        writeChannelCache(res);
        return res;
      },
      initialData: readChannelCache,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }),
  /**
   * Registered thread-cache channels (meta only — `addedAt`/`refreshedAt`/count).
   * Backed by the main-process JSON store, so we never auto-refetch; mutations
   * invalidate this key explicitly.
   */
  listThreadChannels: () =>
    queryOptions({
      queryKey: slackKeys.threadChannels(),
      queryFn: () => slackApi.listThreadChannels(),
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }),
  /** Full snapshot for a single channel. Disk read; no API call. */
  loadThreadChannel: (channelId: string) =>
    queryOptions({
      queryKey: slackKeys.threadChannel(channelId),
      queryFn: () => slackApi.loadThreadChannel({ channelId }),
      enabled: !!channelId,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }),
};

export const slackMutations = {
  testConnection: () =>
    mutationOptions({
      mutationKey: [...slackKeys.all, 'testConnection'] as const,
      mutationFn: () => slackApi.testConnection(),
    }),
  fetchMessages: () =>
    mutationOptions({
      mutationKey: [...slackKeys.all, 'fetchMessages'] as const,
      mutationFn: (req: FetchMessagesRequest) => slackApi.fetchMessages(req),
    }),
  fetchMyReactions: () =>
    mutationOptions({
      mutationKey: [...slackKeys.all, 'fetchMyReactions'] as const,
      mutationFn: (req: FetchMyReactionsRequest) =>
        slackApi.fetchMyReactions(req),
    }),
  summarize: () =>
    mutationOptions({
      mutationKey: [...slackKeys.all, 'summarize'] as const,
      mutationFn: (req: SummarizeRequest) => slackApi.summarize(req),
    }),
  addThreadChannel: () =>
    mutationOptions({
      mutationKey: [...slackKeys.all, 'addThreadChannel'] as const,
      mutationFn: (req: AddThreadChannelRequest) =>
        slackApi.addThreadChannel(req),
    }),
  refreshThreadChannel: () =>
    mutationOptions({
      mutationKey: [...slackKeys.all, 'refreshThreadChannel'] as const,
      mutationFn: (req: RefreshThreadChannelRequest) =>
        slackApi.refreshThreadChannel(req),
    }),
  removeThreadChannel: () =>
    mutationOptions({
      mutationKey: [...slackKeys.all, 'removeThreadChannel'] as const,
      mutationFn: (req: RemoveThreadChannelRequest) =>
        slackApi.removeThreadChannel(req),
    }),
  loadThreadReplies: () =>
    mutationOptions({
      mutationKey: [...slackKeys.all, 'loadThreadReplies'] as const,
      mutationFn: (req: LoadThreadRepliesRequest) =>
        slackApi.loadThreadReplies(req),
    }),
};
