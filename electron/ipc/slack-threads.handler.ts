import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  addThreadChannelRequestSchema,
  loadThreadChannelRequestSchema,
  loadThreadRepliesRequestSchema,
  refreshThreadChannelRequestSchema,
  removeThreadChannelRequestSchema,
  type AddOrRefreshThreadChannelResponse,
  type ListThreadChannelsResponse,
  type LoadThreadChannelResponse,
  type LoadThreadRepliesResponse,
  type RemoveThreadChannelResponse,
} from '../contracts/slack';
import type { SlackThreadsService } from '../services/slack-threads.service';
import { toApiError } from '../infra/error';

export function registerSlackThreadHandlers(
  service: SlackThreadsService,
): void {
  ipcMain.handle(
    CHANNELS.slack.listThreadChannels,
    async (): Promise<ListThreadChannelsResponse> => {
      try {
        return await service.listChannels();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.loadThreadChannel,
    async (_e, raw): Promise<LoadThreadChannelResponse> => {
      try {
        const req = loadThreadChannelRequestSchema.parse(raw);
        return await service.load(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.addThreadChannel,
    async (_e, raw): Promise<AddOrRefreshThreadChannelResponse> => {
      try {
        const req = addThreadChannelRequestSchema.parse(raw);
        return await service.add(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.refreshThreadChannel,
    async (_e, raw): Promise<AddOrRefreshThreadChannelResponse> => {
      try {
        const req = refreshThreadChannelRequestSchema.parse(raw);
        return await service.refresh(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.removeThreadChannel,
    async (_e, raw): Promise<RemoveThreadChannelResponse> => {
      try {
        const req = removeThreadChannelRequestSchema.parse(raw);
        return await service.remove(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.slack.loadThreadReplies,
    async (_e, raw): Promise<LoadThreadRepliesResponse> => {
      try {
        const req = loadThreadRepliesRequestSchema.parse(raw);
        return await service.loadReplies(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
