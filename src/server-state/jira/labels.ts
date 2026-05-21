import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { jiraLabelApi } from '../../api/jira/label';
import { jiraKeys } from './keys';

export const jiraLabelKeys = {
  all: [...jiraKeys.all, 'labels'] as const,
  notes: () => [...jiraLabelKeys.all, 'notes'] as const,
  searchByLabel: (projectKey: string, label: string) =>
    [...jiraLabelKeys.all, 'search', { projectKey, label }] as const,
};

export const jiraLabelQueries = {
  notes: () =>
    queryOptions({
      queryKey: jiraLabelKeys.notes(),
      queryFn: () => jiraLabelApi.getNotes(),
      staleTime: 30_000,
    }),
};

export const jiraLabelMutations = {
  saveNotes: () =>
    mutationOptions({
      mutationKey: [...jiraLabelKeys.all, 'saveNotes'] as const,
      mutationFn: jiraLabelApi.saveNotes,
    }),
  searchByLabel: () =>
    mutationOptions({
      mutationKey: [...jiraLabelKeys.all, 'searchByLabel'] as const,
      mutationFn: jiraLabelApi.searchByLabel,
    }),
  bulkReplace: () =>
    mutationOptions({
      mutationKey: [...jiraLabelKeys.all, 'bulkReplace'] as const,
      mutationFn: jiraLabelApi.bulkReplace,
    }),
  updateIssueLabels: () =>
    mutationOptions({
      mutationKey: [...jiraLabelKeys.all, 'updateIssueLabels'] as const,
      mutationFn: jiraLabelApi.updateIssueLabels,
    }),
  suggest: () =>
    mutationOptions({
      mutationKey: [...jiraLabelKeys.all, 'suggest'] as const,
      mutationFn: jiraLabelApi.suggest,
    }),
};

export type {
  BulkReplaceResponse,
  LabelNote,
  SearchByLabelResponse,
  SuggestLabelResponse,
} from '../../api/jira/label';
