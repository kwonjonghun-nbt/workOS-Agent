import type {
  FetchMessagesRequest,
  FetchMessagesResponse,
  FetchMyReactionsRequest,
  FetchMyReactionsResponse,
  ListChannelsRequest,
  ListChannelsResponse,
  SlackTestConnectionResponse,
  SummarizeRequest,
  SummarizeResponse,
} from './types';

function api() {
  return window.electronAPI.slack;
}

export const slackApi = {
  listChannels: (
    req: ListChannelsRequest = {},
  ): Promise<ListChannelsResponse> => api().listChannels(req),
  fetchMessages: (req: FetchMessagesRequest): Promise<FetchMessagesResponse> =>
    api().fetchMessages(req),
  fetchMyReactions: (
    req: FetchMyReactionsRequest,
  ): Promise<FetchMyReactionsResponse> => api().fetchMyReactions(req),
  summarize: (req: SummarizeRequest): Promise<SummarizeResponse> =>
    api().summarize(req),
  testConnection: (): Promise<SlackTestConnectionResponse> =>
    api().testConnection(),
};

export type {
  FetchMessagesRequest,
  FetchMessagesResponse,
  FetchMyReactionsRequest,
  FetchMyReactionsResponse,
  ListChannelsRequest,
  ListChannelsResponse,
  SlackChannelKind,
  SlackChannelSummary,
  SlackMessageDigestItem,
  SlackReactionHit,
  SlackTestConnectionResponse,
  SummarizeRequest,
  SummarizeResponse,
} from './types';
