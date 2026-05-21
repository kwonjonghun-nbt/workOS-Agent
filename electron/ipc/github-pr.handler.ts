import { ipcMain } from 'electron';
import { CHANNELS } from '../contracts/channels';
import {
  listPullRequestsRequestSchema,
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
}
