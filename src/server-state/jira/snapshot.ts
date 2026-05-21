import { mutationOptions, queryOptions } from '@tanstack/react-query';
import { jiraSnapshotApi } from '../../api/jira/snapshot';
import { jiraKeys } from './keys';

export const jiraSnapshotKeys = {
  all: [...jiraKeys.all, 'snapshot'] as const,
  latest: () => [...jiraSnapshotKeys.all, 'latest'] as const,
  meta: () => [...jiraSnapshotKeys.all, 'meta'] as const,
};

export const jiraSnapshotQueries = {
  latest: () =>
    queryOptions({
      queryKey: jiraSnapshotKeys.latest(),
      queryFn: () => jiraSnapshotApi.getLatest(),
      staleTime: 30_000,
    }),
  meta: () =>
    queryOptions({
      queryKey: jiraSnapshotKeys.meta(),
      queryFn: () => jiraSnapshotApi.getMeta(),
      staleTime: 30_000,
    }),
};

export const jiraSnapshotMutations = {
  trigger: () =>
    mutationOptions({
      mutationKey: [...jiraSnapshotKeys.all, 'trigger'] as const,
      mutationFn: () => jiraSnapshotApi.trigger({ trigger: 'manual' }),
    }),
};

export type {
  MetaData,
  NormalizedIssue,
  StoredData,
  SyncHistoryEntry,
  SyncProgressEvent,
  TriggerSyncResponse,
} from '../../api/jira/snapshot';
