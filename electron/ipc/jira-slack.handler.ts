import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  findThreadMessageRequestSchema,
  testSlackConnectionRequestSchema,
  type FindThreadMessageResponse,
  type PreviewDailyReportResponse,
  type SendDailyReportResponse,
  type TestSlackConnectionResponse,
} from '../contracts/jira-slack';
import type { JiraSlackService } from '../services/jira-slack.service';
import { toApiError } from '../infra/error';

export function registerJiraSlackHandlers(service: JiraSlackService): void {
  ipcMain.handle(
    CHANNELS.jiraSlack.testConnection,
    async (_e, raw): Promise<TestSlackConnectionResponse> => {
      try {
        const req = testSlackConnectionRequestSchema.parse(raw);
        return await service.testConnection(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraSlack.findThreadMessage,
    async (_e, raw): Promise<FindThreadMessageResponse> => {
      try {
        const req = findThreadMessageRequestSchema.parse(raw);
        return await service.findThreadMessage(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraSlack.sendDailyReport,
    async (): Promise<SendDailyReportResponse> => {
      try {
        return await service.sendDailyReport();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraSlack.previewDailyReport,
    async (): Promise<PreviewDailyReportResponse> => {
      try {
        return await service.previewDailyReport();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
