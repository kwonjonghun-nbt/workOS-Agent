import { mutationOptions } from '@tanstack/react-query';
import { jiraApi } from '../../api/jira';
import type {
  CreateIssueRequest,
  CreateIssueResponse,
  TransitionIssueRequest,
  TransitionIssueResponse,
} from '../../api/jira';

export const jiraMutations = {
  createIssue: () =>
    mutationOptions<CreateIssueResponse, Error, CreateIssueRequest>({
      mutationFn: (r) => jiraApi.createIssue(r),
    }),
  transitionIssue: () =>
    mutationOptions<TransitionIssueResponse, Error, TransitionIssueRequest>({
      mutationFn: (r) => jiraApi.transitionIssue(r),
    }),
};
