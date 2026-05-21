import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  deleteReportRequestSchema,
  generateReportRequestSchema,
  getReportRequestSchema,
  saveReportRequestSchema,
  type GenerateReportResponse,
  type GetReportResponse,
  type ReportMeta,
} from '../contracts/jira-reports';
import type { JiraReportService } from '../services/jira-report.service';
import { toApiError } from '../infra/error';

export function registerJiraReportHandlers(service: JiraReportService): void {
  ipcMain.handle(
    CHANNELS.jiraReports.list,
    async (): Promise<{ files: ReportMeta[] }> => {
      try {
        const files = await service.list();
        return { files };
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraReports.get,
    async (_e, raw): Promise<GetReportResponse> => {
      try {
        const req = getReportRequestSchema.parse(raw);
        return await service.get(req.filename);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraReports.save,
    async (_e, raw): Promise<void> => {
      try {
        const req = saveReportRequestSchema.parse(raw);
        await service.save(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraReports.delete,
    async (_e, raw): Promise<void> => {
      try {
        const req = deleteReportRequestSchema.parse(raw);
        await service.delete(req.filename);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraReports.generate,
    async (_e, raw): Promise<GenerateReportResponse> => {
      try {
        const req = generateReportRequestSchema.parse(raw);
        return await service.generate(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
