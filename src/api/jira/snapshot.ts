import type {
  MetaData,
  StoredData,
  SyncProgressEvent,
  TriggerSyncRequest,
  TriggerSyncResponse,
} from './snapshot-types';

function api() {
  return window.electronAPI.jiraSnapshot;
}

export const jiraSnapshotApi = {
  trigger: (req: TriggerSyncRequest = {}): Promise<TriggerSyncResponse> =>
    api().trigger(req),
  getLatest: (): Promise<StoredData | null> => api().getLatest(),
  getMeta: (): Promise<MetaData> => api().getMeta(),
  onProgress: (listener: (event: SyncProgressEvent) => void): (() => void) =>
    api().onProgress(listener),
};

export type {
  MetaData,
  NormalizedIssue,
  StoredData,
  SyncHistoryEntry,
  SyncProgressEvent,
  TriggerSyncRequest,
  TriggerSyncResponse,
} from './snapshot-types';
