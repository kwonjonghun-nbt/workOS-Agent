import type {
  AddOrRefreshThreadChannelResponse,
  AddThreadChannelRequest,
  FetchMessagesRequest,
  FetchMessagesResponse,
  FetchMyReactionsRequest,
  FetchMyReactionsResponse,
  ListChannelsRequest,
  ListChannelsResponse,
  ListThreadChannelsResponse,
  LoadThreadChannelRequest,
  LoadThreadChannelResponse,
  LoadThreadRepliesRequest,
  LoadThreadRepliesResponse,
  RefreshThreadChannelRequest,
  RemoveThreadChannelRequest,
  RemoveThreadChannelResponse,
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
  listThreadChannels: (): Promise<ListThreadChannelsResponse> =>
    api().listThreadChannels(),
  loadThreadChannel: (
    req: LoadThreadChannelRequest,
  ): Promise<LoadThreadChannelResponse> => api().loadThreadChannel(req),
  addThreadChannel: (
    req: AddThreadChannelRequest,
  ): Promise<AddOrRefreshThreadChannelResponse> => api().addThreadChannel(req),
  refreshThreadChannel: (
    req: RefreshThreadChannelRequest,
  ): Promise<AddOrRefreshThreadChannelResponse> =>
    api().refreshThreadChannel(req),
  removeThreadChannel: (
    req: RemoveThreadChannelRequest,
  ): Promise<RemoveThreadChannelResponse> => api().removeThreadChannel(req),
  loadThreadReplies: (
    req: LoadThreadRepliesRequest,
  ): Promise<LoadThreadRepliesResponse> => api().loadThreadReplies(req),
};

export type {
  AddOrRefreshThreadChannelResponse,
  AddThreadChannelRequest,
  FetchMessagesRequest,
  FetchMessagesResponse,
  FetchMyReactionsRequest,
  FetchMyReactionsResponse,
  ListChannelsRequest,
  ListChannelsResponse,
  ListThreadChannelsResponse,
  LoadThreadChannelRequest,
  LoadThreadChannelResponse,
  LoadThreadRepliesRequest,
  LoadThreadRepliesResponse,
  RefreshThreadChannelRequest,
  RemoveThreadChannelRequest,
  RemoveThreadChannelResponse,
  SlackChannelKind,
  SlackChannelSummary,
  SlackMessageDigestItem,
  SlackReactionHit,
  SlackSummaryTemplate,
  SlackTestConnectionResponse,
  SlackThreadChannelCache,
  SlackThreadChannelMeta,
  SlackThreadParent,
  SlackThreadReply,
  SummarizeRequest,
  SummarizeResponse,
} from './types';
export { SLACK_SUMMARY_TEMPLATES } from './types';
