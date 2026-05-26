import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { slackApi } from '../../api/slack';
import { slackKeys } from './keys';
import type {
  FetchMessagesRequest,
  FetchMyReactionsRequest,
  ListChannelsResponse,
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
};
