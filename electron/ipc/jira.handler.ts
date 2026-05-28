import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  createIssueRequestSchema,
  getIssueDetailRequestSchema,
  getTransitionsRequestSchema,
  listIssueChildrenRequestSchema,
  listMyIssuesRequestSchema,
  transitionIssueRequestSchema,
  type CreateIssueResponse,
  type GetIssueDetailResponse,
  type GetTransitionsResponse,
  type ListIssueChildrenResponse,
  type ListMyIssuesResponse,
  type TestConnectionResponse,
  type TransitionIssueResponse,
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

  ipcMain.handle(
    CHANNELS.jira.createIssue,
    async (_e, raw): Promise<CreateIssueResponse> => {
      try {
        const req = createIssueRequestSchema.parse(raw);
        return await service.createIssue(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jira.listIssueChildren,
    async (_e, raw): Promise<ListIssueChildrenResponse> => {
      try {
        const req = listIssueChildrenRequestSchema.parse(raw);
        return await service.listIssueChildren(req.parentKey);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jira.getTransitions,
    async (_e, raw): Promise<GetTransitionsResponse> => {
      try {
        const req = getTransitionsRequestSchema.parse(raw);
        return await service.getTransitions(req.issueKey);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jira.transitionIssue,
    async (_e, raw): Promise<TransitionIssueResponse> => {
      try {
        const req = transitionIssueRequestSchema.parse(raw);
        return await service.transitionIssue(req.issueKey, {
          transitionId: req.transitionId,
          transitionName: req.transitionName,
        });
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
