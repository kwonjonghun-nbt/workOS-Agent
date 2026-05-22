import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  createReleaseBranchRequestSchema,
  createReleaseTagRequestSchema,
  listPullRequestsRequestSchema,
  type CreateReleaseBranchResponse,
  type CreateReleaseTagResponse,
  type GithubPrListReposResponse,
  type GithubPrTestConnectionResponse,
  type ListPullRequestsResponse,
} from '../contracts/github-pr';
import type { GitHubPrService } from '../services/github-pr.service';
import { toApiError } from '../infra/error';

export function registerGitHubPrHandlers(service: GitHubPrService): void {
  ipcMain.handle(
    CHANNELS.githubPr.listPullRequests,
    async (_e, raw): Promise<ListPullRequestsResponse> => {
      try {
        const { state } = listPullRequestsRequestSchema.parse(raw);
        return await service.listPullRequests(state);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.githubPr.testConnection,
    async (): Promise<GithubPrTestConnectionResponse> => {
      try {
        return await service.testConnection();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.githubPr.listRepos,
    async (): Promise<GithubPrListReposResponse> => {
      try {
        return await service.listRepos();
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.githubPr.createReleaseBranch,
    async (_e, raw): Promise<CreateReleaseBranchResponse> => {
      try {
        const req = createReleaseBranchRequestSchema.parse(raw);
        return await service.createReleaseBranch(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );

  ipcMain.handle(
    CHANNELS.githubPr.createReleaseTag,
    async (_e, raw): Promise<CreateReleaseTagResponse> => {
      try {
        const req = createReleaseTagRequestSchema.parse(raw);
        return await service.createReleaseTag(req);
      } catch (err) {
        throw toApiError(err);
      }
    },
  );
}
