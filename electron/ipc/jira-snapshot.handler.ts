import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  triggerSyncRequestSchema,
  type GetLatestResponse,
  type GetMetaResponse,
  type TriggerSyncResponse,
} from '../contracts/jira-snapshot';
import type { JiraSnapshotService } from '../services/jira-snapshot.service';
import { toApiError } from '../infra/error';

export function registerJiraSnapshotHandlers(
  service: JiraSnapshotService,
): void {
  ipcMain.handle(
    CHANNELS.jiraSnapshot.trigger,
    async (_e, raw): Promise<TriggerSyncResponse> => {
      try {
        const { trigger } = triggerSyncRequestSchema.parse(raw ?? {});
        return await service.sync(trigger);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraSnapshot.getLatest,
    async (): Promise<GetLatestResponse> => {
      try {
        return await service.getLatest();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraSnapshot.getMeta,
    async (): Promise<GetMetaResponse> => {
      try {
        return await service.getMeta();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
