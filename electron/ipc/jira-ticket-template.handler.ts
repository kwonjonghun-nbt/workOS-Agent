import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  getTicketTemplateRequestSchema,
  saveTicketTemplateRequestSchema,
  type ListTicketTemplatesResponse,
  type TicketTemplate,
} from '../contracts/jira-ticket-template';
import type { JiraTicketTemplateService } from '../services/jira-ticket-template.service';
import { toApiError } from '../infra/error';

export function registerJiraTicketTemplateHandlers(
  service: JiraTicketTemplateService,
): void {
  ipcMain.handle(
    CHANNELS.jiraTicketTemplates.list,
    async (): Promise<ListTicketTemplatesResponse> => {
      try {
        return await service.list();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraTicketTemplates.get,
    async (_e, raw): Promise<TicketTemplate> => {
      try {
        const req = getTicketTemplateRequestSchema.parse(raw);
        return await service.get(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraTicketTemplates.save,
    async (_e, raw): Promise<TicketTemplate> => {
      try {
        const req = saveTicketTemplateRequestSchema.parse(raw);
        return await service.save(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraTicketTemplates.reset,
    async (_e, raw): Promise<TicketTemplate> => {
      try {
        const req = getTicketTemplateRequestSchema.parse(raw);
        return await service.reset(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
