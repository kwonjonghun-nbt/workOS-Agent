// Type-only mirror of electron/contracts/jira-snapshot.ts.

export type NormalizedIssue = {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string | null;
  issueType: string;
  assignee: string | null;
  assigneeEmail: string | null;
  reporter: string | null;
  created: string;
  updated: string;
  url: string;
  labels: string[];
  dueDate: string | null;
  startDate: string | null;
  storyPoints: number | null;
  parentKey: string | null;
};

export type StoredData = {
  syncedAt: string;
  source: { baseUrl: string; projectKeys: string[] };
  issues: NormalizedIssue[];
  totalCount: number;
};

export type SyncHistoryEntry = {
  at: string;
  trigger: 'manual' | 'scheduled';
  ok: boolean;
  count: number;
  error?: string;
};

export type MetaData = {
  lastSyncAt: string | null;
  history: SyncHistoryEntry[];
};

export type TriggerSyncRequest = { trigger?: 'manual' | 'scheduled' };
export type TriggerSyncResponse = {
  ok: true;
  count: number;
  syncedAt: string;
};

export type SyncProgressEvent = {
  phase: 'started' | 'fetching' | 'saving' | 'completed' | 'failed';
  message?: string;
  count?: number;
};
