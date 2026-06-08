import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  createIssueRequestSchema,
  getIssueDetailRequestSchema,
  listEpicsRequestSchema,
  listIssueTypesRequestSchema,
  listMyIssuesRequestSchema,
  searchIssuesRequestSchema,
  type CreateIssueResponse,
  type GetIssueDetailResponse,
  type ListEpicsResponse,
  type ListIssueTypesResponse,
  type ListMyIssuesResponse,
  type ListProjectsResponse,
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

  ipcMain.handle(
    CHANNELS.jira.listIssueTypes,
    async (_e, raw): Promise<ListIssueTypesResponse> => {
      try {
        const req = listIssueTypesRequestSchema.parse(raw);
        return await service.listIssueTypes(req.projectKey);
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
    CHANNELS.jira.listEpics,
    async (_e, raw): Promise<ListEpicsResponse> => {
      try {
        const req = listEpicsRequestSchema.parse(raw);
        return await service.listEpics(req.projectKey);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.jira.searchIssues,
    async (_e, raw): Promise<ListMyIssuesResponse> => {
      try {
        const req = searchIssuesRequestSchema.parse(raw);
        return await service.searchIssues(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(CHANNELS.jira.listProjects, async (): Promise<ListProjectsResponse> => {
    try {
      return await service.listProjects();
    } catch (err) {
      throw toApiError(err);
    }
  });
}
