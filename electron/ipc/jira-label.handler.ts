import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  bulkReplaceRequestSchema,
  saveLabelNotesRequestSchema,
  searchByLabelRequestSchema,
  suggestLabelRequestSchema,
  updateIssueLabelsRequestSchema,
  type BulkReplaceResponse,
  type LabelNote,
  type SearchByLabelResponse,
  type SuggestLabelResponse,
} from '../contracts/jira-labels';
import type { JiraLabelService } from '../services/jira-label.service';
import { toApiError } from '../infra/error';

export function registerJiraLabelHandlers(service: JiraLabelService): void {
  ipcMain.handle(
    CHANNELS.jiraLabels.getNotes,
    async (): Promise<LabelNote[]> => {
      try {
        return await service.getNotes();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraLabels.saveNotes,
    async (_e, raw): Promise<LabelNote[]> => {
      try {
        const req = saveLabelNotesRequestSchema.parse(raw);
        return await service.saveNotes(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraLabels.searchByLabel,
    async (_e, raw): Promise<SearchByLabelResponse> => {
      try {
        const req = searchByLabelRequestSchema.parse(raw);
        return await service.searchByLabel(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraLabels.bulkReplace,
    async (_e, raw): Promise<BulkReplaceResponse> => {
      try {
        const req = bulkReplaceRequestSchema.parse(raw);
        return await service.bulkReplace(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraLabels.updateIssueLabels,
    async (_e, raw): Promise<void> => {
      try {
        const req = updateIssueLabelsRequestSchema.parse(raw);
        await service.updateIssueLabels(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jiraLabels.suggest,
    async (_e, raw): Promise<SuggestLabelResponse> => {
      try {
        const req = suggestLabelRequestSchema.parse(raw);
        return await service.suggestLabel(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
