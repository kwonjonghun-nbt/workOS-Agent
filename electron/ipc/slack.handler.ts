import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  fetchMessagesRequestSchema,
  fetchMyReactionsRequestSchema,
  listChannelsRequestSchema,
  summarizeRequestSchema,
  type FetchMessagesResponse,
  type FetchMyReactionsResponse,
  type ListChannelsResponse,
  type SlackTestConnectionResponse,
  type SummarizeResponse,
} from '../contracts/slack';
import type { SlackService } from '../services/slack.service';
import type { SlackSummarizeService } from '../services/slack-summarize.service';
import { toApiError } from '../infra/error';

export function registerSlackHandlers(
  service: SlackService,
  summarize: SlackSummarizeService,
): void {
  ipcMain.handle(
    CHANNELS.slack.listChannels,
    async (_e, raw): Promise<ListChannelsResponse> => {
      try {
        const req = listChannelsRequestSchema.parse(raw);
        return await service.listChannels(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.fetchMessages,
    async (_e, raw): Promise<FetchMessagesResponse> => {
      try {
        const req = fetchMessagesRequestSchema.parse(raw);
        return await service.fetchMessages(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.fetchMyReactions,
    async (_e, raw): Promise<FetchMyReactionsResponse> => {
      try {
        const req = fetchMyReactionsRequestSchema.parse(raw);
        return await service.fetchMyReactions(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.summarize,
    async (_e, raw): Promise<SummarizeResponse> => {
      try {
        const req = summarizeRequestSchema.parse(raw);
        return await summarize.summarize(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.testConnection,
    async (): Promise<SlackTestConnectionResponse> => {
      try {
        return await service.testConnection();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
