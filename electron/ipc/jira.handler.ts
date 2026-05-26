import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  getIssueDetailRequestSchema,
  listMyIssuesRequestSchema,
  type GetIssueDetailResponse,
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

  ipcMain.handle(
    CHANNELS.jira.getIssueDetail,
    async (_e, raw): Promise<GetIssueDetailResponse> => {
      try {
        const req = getIssueDetailRequestSchema.parse(raw);
        return await service.getIssueDetail(req.issueKey);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
