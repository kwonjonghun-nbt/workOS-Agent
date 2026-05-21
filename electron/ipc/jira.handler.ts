import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  listMyIssuesRequestSchema,
  type ListMyIssuesResponse,
  type TestConnectionResponse,
} from '../contracts/jira';
import type { JiraService } from '../services/jira.service';
import { toApiError } from '../infra/error';

export function registerJiraHandlers(service: JiraService): void {
  ipcMain.handle(
    CHANNELS.jira.listMyIssues,
    async (_e, raw): Promise<ListMyIssuesResponse> => {
      try {
        const { maxResults } = listMyIssuesRequestSchema.parse(raw);
        return await service.listMyIssues(maxResults);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jira.testConnection,
    async (): Promise<TestConnectionResponse> => {
      try {
        return await service.testConnection();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
